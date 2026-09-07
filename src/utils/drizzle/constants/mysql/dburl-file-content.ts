import type { Language } from "../../../../types.js";

function dbUrlFileContent(language: Language) {
  if (language === "js") {
    return `import { existsSync, readFileSync } from 'node:fs';


const SSL_REQUIRED_HOST_SUFFIXES = [
  'tidbcloud.com',      // TiDB Cloud
  'psdb.cloud',          // PlanetScale
  'aivencloud.com',      // Aiven
  'amazonaws.com',       // RDS / Aurora
  'azure.com',           // Azure Database for MySQL
  'render.com',          // Render
  'railway.app',         // Railway
  'digitalocean.com',    // DigitalOcean Managed MySQL
];

function hostRequiresSSL(hostname) {
  return SSL_REQUIRED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
}

/**
 * Parses a mysql:// connection string into discrete pool credentials AND a
 * normalized connection string, so drizzle-kit (CLI) and mysql2 (runtime pool)
 * always agree on host/port/ssl — no drift between the two.
 *
 * @param {string | undefined} connectionString
 * @returns {{
 *   host: string,
 *   port: number,
 *   user: string,
 *   password: string,
 *   database: string,
 *   ssl: false | { rejectUnauthorized: boolean, ca?: string },
 *   connectionString: string
 * }}
 */
export function parseDatabaseUrl(connectionString) {
  if (!connectionString) {
    throw new Error('[db] DATABASE_URL is not set.');
  }

  let url;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error('[db] DATABASE_URL is not a valid connection string.');
  }

  if (!['mysql:', 'mysql2:'].includes(url.protocol)) {
    throw new Error('[db] Unsupported protocol', url.protocol, ' — expected mysql://');
  }

  const params = url.searchParams;
  const sslParam = params.get('ssl');
  const sslMode = params.get('sslmode') ?? params.get('ssl-mode');
  const sslAccept = params.get('sslaccept'); // PlanetScale-style: strict | accept_invalid_certs

  const explicitlyDisabled = sslParam === 'false' || sslMode === 'disable';
  const explicitlyEnabled =
    (sslParam !== null && sslParam !== 'false') ||
    (sslMode !== null && sslMode !== 'disable') ||
    sslAccept !== null;

  const needsSSL =
    !explicitlyDisabled &&
    (explicitlyEnabled || hostRequiresSSL(url.hostname) || process.env.NODE_ENV === 'production');

  let ssl = false;
  if (needsSSL) {
    const rejectUnauthorized = sslAccept !== 'accept_invalid_certs';
    ssl = { rejectUnauthorized };

    const caPath = process.env.DATABASE_SSL_CA_PATH;
    if (caPath && existsSync(caPath)) {
      ssl.ca = readFileSync(caPath, 'utf8');
    }
  }

  // Normalize the connection string: strip the ad-hoc ssl params we just
  // interpreted, and encode our final SSL decision back in as ssl=<json>,
  // which is the form both mysql2 and drizzle-kit understand.
  const normalized = new URL(url.toString());
  normalized.searchParams.delete('sslmode');
  normalized.searchParams.delete('ssl-mode');
  normalized.searchParams.delete('sslaccept');
  if (ssl) {
    normalized.searchParams.set('ssl', JSON.stringify({ rejectUnauthorized: ssl.rejectUnauthorized }));
  } else {
    normalized.searchParams.delete('ssl');
  }

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\\//, ''),
    ssl,
    connectionString: normalized.toString(),
  };
}
      `;
  } else {
    return `import { existsSync, readFileSync } from 'node:fs';

export interface ParsedDbConnection {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: false | { rejectUnauthorized: boolean; ca?: string };
  /** Normalized connection string — safe to hand to drizzle-kit and mysql2 alike. */
  connectionString: string;
}

/**
 * Hostnames of managed MySQL providers that require (or strongly expect) TLS.
 * Extend this list as you onboard new providers.
 */
const SSL_REQUIRED_HOST_SUFFIXES = [
  'tidbcloud.com',      // TiDB Cloud
  'psdb.cloud',          // PlanetScale
  'aivencloud.com',      // Aiven
  'amazonaws.com',       // RDS / Aurora
  'azure.com',           // Azure Database for MySQL
  'render.com',          // Render
  'railway.app',         // Railway
  'digitalocean.com',    // DigitalOcean Managed MySQL
];

function hostRequiresSSL(hostname: string): boolean {
  return SSL_REQUIRED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
}

/**
 * Parses a mysql:// connection string into discrete pool credentials AND a
 * normalized connection string, so drizzle-kit (CLI) and mysql2 (runtime pool)
 * always agree on host/port/ssl — no drift between the two.
 */
export function parseDatabaseUrl(connectionString: string | undefined): ParsedDbConnection {
  if (!connectionString) {
    throw new Error('[db] DATABASE_URL is not set.');
  }

  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error('[db] DATABASE_URL is not a valid connection string.');
  }

  if (!['mysql:', 'mysql2:'].includes(url.protocol)) {
    throw new Error("[db] Unsupported protocol url.protocol — expected mysql://");
  }

  const params = url.searchParams;
  const sslParam = params.get('ssl');
  const sslMode = params.get('sslmode') ?? params.get('ssl-mode');
  const sslAccept = params.get('sslaccept'); // PlanetScale-style: strict | accept_invalid_certs

  const explicitlyDisabled = sslParam === 'false' || sslMode === 'disable';
  const explicitlyEnabled =
    (sslParam !== null && sslParam !== 'false') ||
    (sslMode !== null && sslMode !== 'disable') ||
    sslAccept !== null;

  const needsSSL =
    !explicitlyDisabled &&
    (explicitlyEnabled || hostRequiresSSL(url.hostname) || process.env.NODE_ENV === 'production');

  let ssl: ParsedDbConnection['ssl'] = false;
  if (needsSSL) {
    const rejectUnauthorized = sslAccept !== 'accept_invalid_certs';
    ssl = { rejectUnauthorized };

    const caPath = process.env.DATABASE_SSL_CA_PATH;
    if (caPath && existsSync(caPath)) {
      ssl.ca = readFileSync(caPath, 'utf8');
    }
  }

  // Normalize the connection string: strip the ad-hoc ssl params we just
  // interpreted, and encode our final SSL decision back in as ssl=<json>,
  // which is the form both mysql2 and drizzle-kit understand.
  const normalized = new URL(url.toString());
  normalized.searchParams.delete('sslmode');
  normalized.searchParams.delete('ssl-mode');
  normalized.searchParams.delete('sslaccept');
  if (ssl) {
    normalized.searchParams.set('ssl', JSON.stringify({ rejectUnauthorized: ssl.rejectUnauthorized }));
  } else {
    normalized.searchParams.delete('ssl');
  }

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\\//, ''),
    ssl,
    connectionString: normalized.toString(),
  };
}
    
    `;
  }
}

export default dbUrlFileContent