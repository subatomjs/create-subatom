// redis-error-content.ts
import { Language } from "../../../types.js";


function redisErrorsFileContent(language: Language): string {
  if (language === "ts") {
    return `export class RedisNotInitializedError extends Error {
  constructor() {
    super('RedisClient not initialized. Call RedisClient.init(config) before getInstance().');
    this.name = 'RedisNotInitializedError';
  }
}

export class RedisConnectionError extends Error {
  constructor(cause: unknown) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    super(\`Failed to connect to Redis: \${reason}\`);
    this.name = 'RedisConnectionError';
    this.cause = cause;
  }
}

export class RedisLockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RedisLockError';
  }
}

export class RedisConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RedisConfigError';
  }
}`;
  } else {
    return `export class RedisNotInitializedError extends Error {
  constructor() {
    super('RedisClient not initialized. Call RedisClient.init(config) before getInstance().');
    this.name = 'RedisNotInitializedError';
  }
}

export class RedisConnectionError extends Error {
  constructor(cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    super(String.raw("Failed to connect to Redis:", reason));
    this.name = 'RedisConnectionError';
    this.cause = cause;
  }
}

export class RedisLockError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RedisLockError';
  }
}

export class RedisConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RedisConfigError';
  }
}`;
  }
}

export default redisErrorsFileContent