// redis-config-content.ts 
import { Language } from "../../../types.js";

function redisConfigFileContent(language: Language): string {
  if (language === "ts") {
    return `import __env from '../config/__env.js';
import { RedisConfigError } from './redis.errors.js';
import { RedisConfig } from './redis.types.js';


/**
 * Builds RedisConfig purely from environment variables.
 * Only REDIS_URL is required — everything else has a safe default.
 * Swapping environments (local / staging / prod, standalone / TLS / managed)
 * is a matter of changing the connection string, nothing else.
 */
export function loadRedisConfig(): RedisConfig {
  const url = __env.REDIS_URL;

  if (!url || url.trim().length === 0) {
    throw new RedisConfigError(
      'REDIS_URL is not defined. Expected something like redis://user:pass@host:port/db or rediss://... for TLS.',
    );
  }

  return {
    url,
    keyPrefix: __env.REDIS_KEY_PREFIX || undefined,
    required: __env.REDIS_REQUIRED === 'true',
    connectTimeoutMs: __env.REDIS_CONNECT_TIMEOUT_MS
      ? Number(__env.REDIS_CONNECT_TIMEOUT_MS)
      : 10_000,
    shutdownTimeoutMs: __env.REDIS_SHUTDOWN_TIMEOUT_MS
      ? Number(__env.REDIS_SHUTDOWN_TIMEOUT_MS)
      : 5_000,
  };
}`;
  } else {
    return `import __env from '../config/__env.js';
import { RedisConfigError } from './redis.errors.js';

/**
 * Builds RedisConfig purely from environment variables.
 * Only REDIS_URL is required — everything else has a safe default.
 * Swapping environments (local / staging / prod, standalone / TLS / managed)
 * is a matter of changing the connection string, nothing else.
 */
export function loadRedisConfig() {
  const url = __env.REDIS_URL;

  if (!url || url.trim().length === 0) {
    throw new RedisConfigError(
      'REDIS_URL is not defined. Expected something like redis://user:pass@host:port/db or rediss://... for TLS.',
    );
  }

  return {
    url,
    keyPrefix: __env.REDIS_KEY_PREFIX || undefined,
    required: __env.REDIS_REQUIRED === 'true',
    connectTimeoutMs: __env.REDIS_CONNECT_TIMEOUT_MS
      ? Number(__env.REDIS_CONNECT_TIMEOUT_MS)
      : 10_000,
    shutdownTimeoutMs: __env.REDIS_SHUTDOWN_TIMEOUT_MS
      ? Number(__env.REDIS_SHUTDOWN_TIMEOUT_MS)
      : 5_000,
  };
}`;
  }
}

export default redisConfigFileContent