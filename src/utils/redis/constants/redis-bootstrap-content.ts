// redis-bootstrap-content.ts 
import { Language } from "../../../types.js";


function redisBootstrapFileContent(language: Language): string {
  if (language === "ts") {
    return `import { RedisClient, loadRedisConfig, RedisConfigError } from "./index.js";



export async function bootstrapRedis(): Promise<RedisClient> {
  let config;
  try {
    config = loadRedisConfig();
  } catch (err) {
    if (err instanceof RedisConfigError) {
      console.error("[main.ts] ❌ Redis config error: " + err.message);
    }
    throw err; // bad config is always fatal — nothing to fall back to
  }

  const redis = RedisClient.init(config);

  try {
    await redis.connect();
    console.log("[main.ts] ✅ Redis connected successfully");
  } catch (err) {
    console.error(
      "[main.ts] ❌ Redis connection failed:",
      err instanceof Error ? err.message : err,
    );

    if (config.required) {
      // Redis is mandatory for this service — do not boot without it.
      console.error("[main.ts] REDIS_REQUIRED=true → aborting startup");
      process.exit(1);
    }

    // Fallback: the app continues in degraded mode. Anything reading/writing
    // through RedisClient should call redis.isHealthy() first (or just let
    // ioredis's offline queue + retryStrategy pick the connection back up —
    // commands issued while disconnected are queued and flushed on reconnect).
    console.warn(
      "[main.ts] ⚠️  Continuing startup without Redis (degraded / cache-less mode)",
    );
  }

  return redis;
}

export function registerGracefulShutdown(redis: RedisClient): void {
  const shutdown = async (signal: string) => {
    console.log("[main.ts] Received " + signal + ", shutting down gracefully...");
    try {
      await redis.disconnect();
      console.log("[main.ts] Redis disconnected cleanly");
    } catch (err) {
      console.error("[main.ts] Error during Redis shutdown:", err);
    } finally {
      process.exit(0);
    }
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

bootstrapRedis().catch((err) => {
  console.error("[main.ts] Fatal error during startup:", err);
  process.exit(1);
});`;
  } else {
    return `import { RedisClient, loadRedisConfig, RedisConfigError } from "./index.js";



export async function bootstrapRedis() {
  let config;
  try {
    config = loadRedisConfig();
  } catch (err) {
    if (err instanceof RedisConfigError) {
      console.error("[main.ts] ❌ Redis config error: " + err.message);
    }
    throw err; // bad config is always fatal — nothing to fall back to
  }

  const redis = RedisClient.init(config);

  try {
    await redis.connect();
    console.log("[main.ts] ✅ Redis connected successfully");
  } catch (err) {
    console.error(
      "[main.ts] ❌ Redis connection failed:",
      err instanceof Error ? err.message : err,
    );

    if (config.required) {
      // Redis is mandatory for this service — do not boot without it.
      console.error("[main.ts] REDIS_REQUIRED=true → aborting startup");
      process.exit(1);
    }

    // Fallback: the app continues in degraded mode. Anything reading/writing
    // through RedisClient should call redis.isHealthy() first (or just let
    // ioredis's offline queue + retryStrategy pick the connection back up —
    // commands issued while disconnected are queued and flushed on reconnect).
    console.warn(
      "[main.ts] ⚠️  Continuing startup without Redis (degraded / cache-less mode)",
    );
  }

  return redis;
}

export function registerGracefulShutdown(redis) {
  const shutdown = async (signal) => {
    console.log("[main.ts] Received " + signal + ", shutting down gracefully...");
    try {
      await redis.disconnect();
      console.log("[main.ts] Redis disconnected cleanly");
    } catch (err) {
      console.error("[main.ts] Error during Redis shutdown:", err);
    } finally {
      process.exit(0);
    }
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

bootstrapRedis().catch((err) => {
  console.error("[main.ts] Fatal error during startup:", err);
  process.exit(1);
});`;
  }
}

export default redisBootstrapFileContent