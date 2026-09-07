// redis-config-content.ts
import type { Language } from "../../../types.js";

function redisConfigFileContent(language: Language): string {
  if (language === "ts") {
    return `import envConfig from '../config/envConfig.js';
import { RedisConfigError } from './redis.errors.js';
import { RedisConfig } from './redis.types.js';


/**
 * Builds RedisConfig purely from environment variables.
 * Only REDIS_URL is required — everything else has a safe default.
 * Swapping environments (local / staging / prod, standalone / TLS / managed)
 * is a matter of changing the connection string, nothing else.
 */
export function loadRedisConfig(): RedisConfig {
  const url = envConfig.REDIS_URL;

  if (!url || url.trim().length === 0) {
    throw new RedisConfigError(
      'REDIS_URL is not defined. Expected something like redis://user:pass@host:port/db or rediss://... for TLS.',
    );
  }

  return {
    url,
    keyPrefix: envConfig.REDIS_KEY_PREFIX || undefined,
    required: envConfig.REDIS_REQUIRED === 'true',
    connectTimeoutMs: envConfig.REDIS_CONNECT_TIMEOUT_MS
      ? Number(envConfig.REDIS_CONNECT_TIMEOUT_MS)
      : 10_000,
    shutdownTimeoutMs: envConfig.REDIS_SHUTDOWN_TIMEOUT_MS
      ? Number(envConfig.REDIS_SHUTDOWN_TIMEOUT_MS)
      : 5_000,
  };
}`;
  } else {
    return `import envConfig from '../config/envConfig.js';
import { RedisConfigError } from './redis.errors.js';

/**
 * Builds RedisConfig purely from environment variables.
 * Only REDIS_URL is required — everything else has a safe default.
 * Swapping environments (local / staging / prod, standalone / TLS / managed)
 * is a matter of changing the connection string, nothing else.
 */
export function loadRedisConfig() {
  const url = envConfig.REDIS_URL;

  if (!url || url.trim().length === 0) {
    throw new RedisConfigError(
      'REDIS_URL is not defined. Expected something like redis://user:pass@host:port/db or rediss://... for TLS.',
    );
  }

  return {
    url,
    keyPrefix: envConfig.REDIS_KEY_PREFIX || undefined,
    required: envConfig.REDIS_REQUIRED === 'true',
    connectTimeoutMs: envConfig.REDIS_CONNECT_TIMEOUT_MS
      ? Number(envConfig.REDIS_CONNECT_TIMEOUT_MS)
      : 10_000,
    shutdownTimeoutMs: envConfig.REDIS_SHUTDOWN_TIMEOUT_MS
      ? Number(envConfig.REDIS_SHUTDOWN_TIMEOUT_MS)
      : 5_000,
  };
}`;
  }
}

export default redisConfigFileContent