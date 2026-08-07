// redis-types-content.ts
const redisTypesFileContent: string = `import { RedisOptions } from 'ioredis';

/**
 * Logger contract — inject your own (pino, winston, etc.) or fall back to console.
 * Kept intentionally minimal so any logging library can satisfy it.
 */
export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  debug?(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Configuration is intentionally DB/ORM agnostic.
 * It only ever needs a connection string — nothing about
 * Prisma / TypeORM / Mongoose / Sequelize leaks into this layer.
 */
export interface RedisConfig {
  /** redis://user:pass@host:port/db  or  rediss://... for TLS */
  url: string;

  /** Namespaces every key this client touches (multi-tenant / multi-service safety) */
  keyPrefix?: string;

  /** Abort process startup if Redis is unreachable (default: false → degrade gracefully) */
  required?: boolean;

  /** Max ms to wait for the initial connection before giving up (default: 10_000) */
  connectTimeoutMs?: number;

  /** Max ms to wait for a graceful quit() during shutdown before force-disconnecting */
  shutdownTimeoutMs?: number;

  /** Injectable logger. Defaults to console.* with a "[Redis]" prefix. */
  logger?: Logger;

  /** Escape hatch: any raw ioredis option is merged in and takes precedence where set */
  options?: RedisOptions;
}

export interface LockHandle {
  key: string;
  token: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the current window resets */
  resetInSeconds: number;
}

export interface HealthStatus {
  healthy: boolean;
  latencyMs: number | null;
  status: 'ready' | 'connecting' | 'reconnecting' | 'disconnected' | 'error';
}

`;

export default redisTypesFileContent