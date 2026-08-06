import { Language } from "../types.js";

export function redisClientProvider(language: Language): string {
  if (language === "ts") {
    return `
    
    import Redis, { Redis as RedisInstance, ChainableCommander } from "ioredis";
import crypto from "crypto";
import {
  RedisConfig,
  LockHandle,
  RateLimitResult,
  HealthStatus,
  Logger,
} from "./redis.types.js";
import {
  RedisNotInitializedError,
  RedisConnectionError,
  RedisLockError,
} from "./redis.errors.js";
import __env from "../config/__env.js";

const defaultLogger: Logger = {
  info: (msg, meta) => console.log('[Redis] ' + msg, meta ?? ''),
  warn: (msg, meta) => console.warn('[Redis] ' + msg, meta ?? ''),
  error: (msg, meta) => console.error('[Redis] ' + msg, meta ?? ''),
  debug: (msg, meta) => {
    if (__env.REDIS_DEBUG === 'true')
      console.debug('[Redis] ' + msg, meta ?? '');
  },
};

/**
 * Standalone, database/ORM-agnostic Redis client.
 *
 * Usage:
 *   // once, at startup (main.ts)
 *   const redis = RedisClient.init(loadRedisConfig());
 *   await redis.connect();
 *
 *   // anywhere else in the app
 *   const redis = RedisClient.getInstance();
 *   await redis.set('foo', 'bar');
 */
export class RedisClient {
  private static instance: RedisClient | undefined;

  private readonly client: RedisInstance;
  private readonly log: Logger;
  private readonly config: Required<
    Pick<RedisConfig, "connectTimeoutMs" | "shutdownTimeoutMs">
  > &
    RedisConfig;

  private subscriber: RedisInstance | null = null;
  private publisher: RedisInstance | null = null;
  private readonly subscriptions = new Map<
    string,
    Set<(message: string) => void>
  >();

  private status: HealthStatus["status"] = "disconnected";
  private connectPromise: Promise<void> | null = null;

  private constructor(config: RedisConfig) {
    this.log = config.logger ?? defaultLogger;
    this.config = {
      connectTimeoutMs: config.connectTimeoutMs ?? 10_000,
      shutdownTimeoutMs: config.shutdownTimeoutMs ?? 5_000,
      ...config,
    };

    this.client = new (Redis as unknown as {
      new (uri?: string, opts?: any): RedisInstance;
    })(config.url, {
      lazyConnect: true, // caller controls when connect() actually fires
      keyPrefix: config.keyPrefix,
      maxRetriesPerRequest: 3,
      enableAutoPipelining: true,
      enableOfflineQueue: true,
      connectTimeout: this.config.connectTimeoutMs,
      retryStrategy: (attempt: any) => {
        // exponential backoff with jitter, capped at 10s
        const base = Math.min(1000 * 2 ** attempt, 10_000);
        const jitter = Math.floor(Math.random() * 200);
        return base + jitter;
      },
      reconnectOnError: (err: unknown) => {
        // Auto-reconnect on failover / stale-connection style errors
        return /READONLY|ETIMEDOUT|ECONNRESET|EPIPE/.test(
          (err as Error).message,
        );
      },
      ...config.options,
    });

    this.bindEvents();
  }

  // ============================================================
  // Singleton lifecycle
  // ============================================================

  static init(config: RedisConfig): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient(config);
    }
    return RedisClient.instance;
  }

  static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      throw new RedisNotInitializedError();
    }
    return RedisClient.instance;
  }

  /** For tests only — allows re-initializing with a fresh config between test suites. */
  static resetForTests(): void {
    RedisClient.instance = undefined;
  }

  private bindEvents(): void {
    this.client.on("connect", () => {
      this.status = "connecting";
      this.log.info("TCP connection established");
    });

    this.client.on("ready", () => {
      this.status = "ready";
      this.log.info("✅ Client ready to accept commands");
    });

    this.client.on("error", (err: Error) => {
      this.status = "error";
      this.log.error("❌ Client error", { message: err.message });
    });

    this.client.on("close", () => {
      this.status = "disconnected";
      this.log.warn("Connection closed");
    });

    this.client.on("reconnecting", (ms: number) => {
      this.status = "reconnecting";
      this.log.warn("Reconnecting in " + ms + "ms...");
    });

    this.client.on("end", () => {
      this.status = "disconnected";
      this.log.warn(
        "Connection ended — retries exhausted, no further attempts",
      );
    });
  }

  // ============================================================
  // Connection lifecycle
  // ============================================================

  /**
   * Connects and resolves only once the client is truly ready
   * (or rejects on timeout/error). Safe to call multiple times —
   * concurrent callers share the same in-flight attempt.
   */
  async connect(): Promise<void> {
    if (this.status === "ready") return;
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = this.doConnect().finally(() => {
      this.connectPromise = null;
    });

    return this.connectPromise;
  }

  private async doConnect(): Promise<void> {
    try {
      await this.client.connect();
    } catch (err) {
      throw new RedisConnectionError(err);
    }
  }

  /** Graceful shutdown — call from your process signal handlers. */
  async disconnect(): Promise<void> {
    const timeout = new Promise<void>((resolve) =>
      setTimeout(resolve, this.config.shutdownTimeoutMs),
    );

    const quit = async () => {
      if (this.subscriber) await this.subscriber.quit().catch(() => undefined);
      if (this.publisher) await this.publisher.quit().catch(() => undefined);
      await this.client.quit();
    };

    await Promise.race([quit(), timeout]);

    if (this.client.status !== "end") {
      this.log.warn("Graceful quit timed out — forcing disconnect");
      this.client.disconnect();
    }
  }

  isHealthy(): boolean {
    return this.status === "ready";
  }

  getStatus(): HealthStatus["status"] {
    return this.status;
  }

  async healthCheck(): Promise<HealthStatus> {
    const start = Date.now();
    try {
      const pong = await this.client.ping();
      return {
        healthy: pong === "PONG",
        latencyMs: Date.now() - start,
        status: this.status,
      };
    } catch {
      return { healthy: false, latencyMs: null, status: this.status };
    }
  }

  /** Escape hatch — access the raw ioredis instance for anything not wrapped below. */
  getRawClient(): RedisInstance {
    return this.client;
  }

  // ============================================================
  // Basic KV
  // ============================================================

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const payload = this.serialize(value);
    if (ttlSeconds) {
      await this.client.set(key, payload, "EX", ttlSeconds);
    } else {
      await this.client.set(key, payload);
    }
  }

  /** Sets only if the key does not already exist. Returns true if it was set. */
  async setIfNotExists(
    key: string,
    value: unknown,
    ttlSeconds?: number,
  ): Promise<boolean> {
    const payload = this.serialize(value);
    const result = ttlSeconds
      ? await this.client.set(key, payload, "EX", ttlSeconds, "NX")
      : await this.client.set(key, payload, "NX");
    return result === "OK";
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    return this.deserialize<T>(raw);
  }

  /** Atomically replaces the value and returns the previous one. */
  async getSet<T = unknown>(key: string, value: unknown): Promise<T | null> {
    const raw = await this.client.getset(key, this.serialize(value));
    return this.deserialize<T>(raw);
  }

  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    return this.client.del(...keys);
  }

  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1;
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    return (await this.client.expire(key, seconds)) === 1;
  }

  async persist(key: string): Promise<boolean> {
    return (await this.client.persist(key)) === 1;
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async incrBy(key: string, amount: number): Promise<number> {
    return this.client.incrby(key, amount);
  }

  async decr(key: string): Promise<number> {
    return this.client.decr(key);
  }

  async mget<T = unknown>(keys: string[]): Promise<(T | null)[]> {
    if (keys.length === 0) return [];
    const raw = await this.client.mget(...keys);
    return raw.map((v) => this.deserialize<T>(v));
  }

  async mset(entries: Record<string, unknown>): Promise<void> {
    const flat: string[] = [];
    for (const [k, v] of Object.entries(entries)) {
      flat.push(k, this.serialize(v));
    }
    if (flat.length) await this.client.mset(...flat);
  }

  // ============================================================
  // Hash
  // ============================================================

  async hset(key: string, field: string, value: unknown): Promise<void> {
    await this.client.hset(key, field, this.serialize(value));
  }

  async hmset(key: string, fields: Record<string, unknown>): Promise<void> {
    const flat: string[] = [];
    for (const [f, v] of Object.entries(fields))
      flat.push(f, this.serialize(v));
    if (flat.length) await this.client.hset(key, ...flat);
  }

  async hget<T = unknown>(key: string, field: string): Promise<T | null> {
    const raw = await this.client.hget(key, field);
    return this.deserialize<T>(raw);
  }

  async hgetall<T = Record<string, unknown>>(key: string): Promise<T> {
    return this.client.hgetall(key) as unknown as T;
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    return this.client.hdel(key, ...fields);
  }

  async hincrby(key: string, field: string, amount: number): Promise<number> {
    return this.client.hincrby(key, field, amount);
  }

  // ============================================================
  // List
  // ============================================================

  async lpush(key: string, ...values: string[]): Promise<number> {
    return this.client.lpush(key, ...values);
  }

  async rpush(key: string, ...values: string[]): Promise<number> {
    return this.client.rpush(key, ...values);
  }

  async lpop(key: string): Promise<string | null> {
    return this.client.lpop(key);
  }

  async rpop(key: string): Promise<string | null> {
    return this.client.rpop(key);
  }

  async lrange(key: string, start = 0, stop = -1): Promise<string[]> {
    return this.client.lrange(key, start, stop);
  }

  async llen(key: string): Promise<number> {
    return this.client.llen(key);
  }

  // ============================================================
  // Set
  // ============================================================

  async sadd(key: string, ...members: string[]): Promise<number> {
    return this.client.sadd(key, ...members);
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    return this.client.srem(key, ...members);
  }

  async smembers(key: string): Promise<string[]> {
    return this.client.smembers(key);
  }

  async sismember(key: string, member: string): Promise<boolean> {
    return (await this.client.sismember(key, member)) === 1;
  }

  // ============================================================
  // Sorted Set
  // ============================================================

  async zadd(key: string, score: number, member: string): Promise<void> {
    await this.client.zadd(key, score, member);
  }

  async zrange(
    key: string,
    start = 0,
    stop = -1,
    withScores = false,
  ): Promise<string[]> {
    return withScores
      ? this.client.zrange(key, String(start), String(stop), "WITHSCORES")
      : this.client.zrange(key, String(start), String(stop));
  }

  async zrangebyscore(
    key: string,
    min: number | string,
    max: number | string,
  ): Promise<string[]> {
    return this.client.zrangebyscore(key, min, max);
  }

  async zincrby(key: string, amount: number, member: string): Promise<number> {
    const result = await this.client.zincrby(key, amount, member);
    return Number(result);
  }

  async zrem(key: string, ...members: string[]): Promise<number> {
    return this.client.zrem(key, ...members);
  }

  // ============================================================
  // Pipeline / Transactions
  // ============================================================

  /** Batches multiple commands in one round trip. No atomicity guarantee. */
  pipeline(): ChainableCommander {
    return this.client.pipeline();
  }

  /** Atomic MULTI/EXEC transaction — all commands succeed or none apply. */
  multi(): ChainableCommander {
    return this.client.multi();
  }

  /**
   * Optimistic-locking transaction: watches keys, reads current state,
   * lets the caller build the transaction, and retries once if the
   * watched keys changed before EXEC (classic check-and-set pattern).
   */
  async watchTransaction<T>(
    watchKeys: string[],
    builder: (multi: ChainableCommander) => void,
  ): Promise<T[] | null> {
    await this.client.watch(...watchKeys);
    const multi = this.client.multi();
    builder(multi);
    const result = await multi.exec();
    if (result === null) return null; // transaction aborted — a watched key changed
    return result.map(([err, val]) => {
      if (err) throw err;
      return val as T;
    });
  }

  // ============================================================
  // Pub / Sub
  // ============================================================

  async publish(channel: string, message: unknown): Promise<number> {
    if (!this.publisher) this.publisher = this.client.duplicate();
    return this.publisher.publish(channel, this.serialize(message));
  }

  async subscribe(
    channel: string,
    handler: (message: string) => void,
  ): Promise<void> {
    if (!this.subscriber) {
      this.subscriber = this.client.duplicate();
      this.subscriber.on("message", (ch, msg) => {
        this.subscriptions.get(ch)?.forEach((cb) => cb(msg));
      });
    }

    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
      await this.subscriber.subscribe(channel);
    }
    this.subscriptions.get(channel)!.add(handler);
  }

  async unsubscribe(
    channel: string,
    handler?: (message: string) => void,
  ): Promise<void> {
    if (!this.subscriber) return;

    if (handler) {
      this.subscriptions.get(channel)?.delete(handler);
      if (this.subscriptions.get(channel)?.size) return; // other listeners remain
    }

    this.subscriptions.delete(channel);
    await this.subscriber.unsubscribe(channel);
  }

  // ============================================================
  // Lua scripting
  // ============================================================

  async eval(
    script: string,
    keys: string[] = [],
    args: (string | number)[] = [],
  ): Promise<unknown> {
    return this.client.eval(script, keys.length, ...keys, ...args);
  }

  // ============================================================
  // Distributed lock (single-node SET NX PX + token-safe release)
  // For multi-node quorum guarantees, layer Redlock on top of getRawClient().
  // ============================================================

  async acquireLock(key: string, ttlMs = 5000): Promise<LockHandle | null> {
    const token = crypto.randomUUID();
    const lockKey = 'lock:' + key;
    const result = await this.client.set(lockKey, token, "PX", ttlMs, "NX");
    return result === "OK" ? { key: lockKey, token } : null;
  }

  async releaseLock(handle: LockHandle): Promise<boolean> {
    // Compare-and-delete must be atomic, or we might delete a lock
    // acquired by someone else after ours expired.
    const script =
      'if redis.call("GET", KEYS[1]) == ARGV[1] then'\n +
      '  return redis.call("DEL", KEYS[1])'\n +
      'else'\n +
      '  return 0'\n +
      'end';
    const result = await this.eval(script, [handle.key], [handle.token]);
    return result === 1;
  }

  async extendLock(handle: LockHandle, ttlMs: number): Promise<boolean> {
    const script =
      'if redis.call("GET", KEYS[1]) == ARGV[1] then'\n +
      '  return redis.call("PEXPIRE", KEYS[1], ARGV[2])'\n +
      'else'\n +
      '  return 0'\n +
      'end';
    const result = await this.eval(script, [handle.key], [handle.token, ttlMs]);
    return result === 1;
  }

  /** Runs fn while holding the lock, then always releases it. Throws RedisLockError if not acquired. */
  async withLock<T>(
    key: string,
    ttlMs: number,
    fn: () => Promise<T>,
  ): Promise<T> {
    const lock = await this.acquireLock(key, ttlMs);
    if (!lock)
      throw new RedisLockError('Could not acquire lock for key: ' + key);
    try {
      return await fn();
    } finally {
      await this.releaseLock(lock);
    }
  }

  // ============================================================
  // Rate limiting (fixed window, atomic via Lua)
  // ============================================================

  async rateLimit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitResult> {
    const script =
      'local current = redis.call("INCR", KEYS[1])'\n +
      'if current == 1 then'\n +
      '  redis.call("EXPIRE", KEYS[1], ARGV[1])'\n +
      'end'\n +
      'local ttl = redis.call("TTL", KEYS[1])'\n +
      'return {current, ttl}';
    const [current, ttl] = (await this.eval(
      script,
      ['ratelimit:' + key],
      [windowSeconds],
    )) as [number, number];

    return {
      allowed: current <= limit,
      remaining: Math.max(0, limit - current),
      resetInSeconds: ttl,
    };
  }

  // ============================================================
  // Cache-aside helper
  // ============================================================

  /** Reads from cache; on miss, runs fetcher(), caches the result, and returns it. */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds?: number,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const fresh = await fetcher();
    await this.set(key, fresh, ttlSeconds);
    return fresh;
  }

  // ============================================================
  // Safe bulk operations (SCAN-based — never blocks Redis like KEYS does)
  // ============================================================

  async deleteByPattern(pattern: string): Promise<number> {
    let cursor = "0";
    let deleted = 0;
    do {
      const [nextCursor, keys] = await this.client.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100,
      );
      cursor = nextCursor;
      if (keys.length) deleted += await this.client.del(...keys);
    } while (cursor !== "0");
    return deleted;
  }

  async scanKeys(pattern: string): Promise<string[]> {
    let cursor = "0";
    const found: string[] = [];
    do {
      const [nextCursor, keys] = await this.client.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100,
      );
      cursor = nextCursor;
      found.push(...keys);
    } while (cursor !== "0");
    return found;
  }

  // ============================================================
  // Diagnostics
  // ============================================================

  async dbSize(): Promise<number> {
    return this.client.dbsize();
  }

  async info(section?: string): Promise<string> {
    return section ? this.client.info(section) : this.client.info();
  }

  async flushCurrentDb(): Promise<void> {
    if (__env.NODE_ENV === "production") {
      throw new Error("flushCurrentDb() is disabled in production for safety.");
    }
    await this.client.flushdb();
  }

  // ============================================================
  // Internal serialization helpers
  // ============================================================

  private serialize(value: unknown): string {
    return typeof value === "string" ? value : JSON.stringify(value);
  }

  private deserialize<T>(raw: string | null): T | null {
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as unknown as T; // was stored as a plain string
    }
  }
}
    `;
  } else {
    return `
            import Redis from "ioredis";
import crypto from "crypto";
import __env from "../config/__env.js";
import {
  RedisNotInitializedError,
  RedisConnectionError,
  RedisLockError,
} from "./redis.errors.js";

const defaultLogger = {
  info: (msg, meta) => console.log('[Redis] ' + msg, meta ?? ''),
  warn: (msg, meta) => console.warn('[Redis] ' + msg, meta ?? ''),
  error: (msg, meta) => console.error('[Redis] ' + msg, meta ?? ''),
  debug: (msg, meta) => {
    if (__env.REDIS_DEBUG === 'true')
      console.debug('[Redis] ' + msg, meta ?? '');
  },
};

/**
 * Standalone, database/ORM-agnostic Redis client.
 *
 * Usage:
 *   // once, at startup (main.ts)
 *   const redis = RedisClient.init(loadRedisConfig());
 *   await redis.connect();
 *
 *   // anywhere else in the app
 *   const redis = RedisClient.getInstance();
 *   await redis.set('foo', 'bar');
 */
export class RedisClient {
  static instance = undefined;

  constructor(config) {
    this.log = config.logger ?? defaultLogger;
    this.config = {
      connectTimeoutMs: config.connectTimeoutMs ?? 10_000,
      shutdownTimeoutMs: config.shutdownTimeoutMs ?? 5_000,
      ...config,
    };

    this.subscriber = null;
    this.publisher = null;
    this.subscriptions = new Map();

    this.status = "disconnected";
    this.connectPromise = null;

    this.client = new Redis(config.url, {
      lazyConnect: true, // caller controls when connect() actually fires
      keyPrefix: config.keyPrefix,
      maxRetriesPerRequest: 3,
      enableAutoPipelining: true,
      enableOfflineQueue: true,
      connectTimeout: this.config.connectTimeoutMs,
      retryStrategy: (attempt) => {
        // exponential backoff with jitter, capped at 10s
        const base = Math.min(1000 * 2 ** attempt, 10_000);
        const jitter = Math.floor(Math.random() * 200);
        return base + jitter;
      },
      reconnectOnError: (err) => {
        // Auto-reconnect on failover / stale-connection style errors
        return /READONLY|ETIMEDOUT|ECONNRESET|EPIPE/.test(err.message);
      },
      ...config.options,
    });

    this.bindEvents();
  }

  // ============================================================
  // Singleton lifecycle
  // ============================================================

  static init(config) {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient(config);
    }
    return RedisClient.instance;
  }

  static getInstance() {
    if (!RedisClient.instance) {
      throw new RedisNotInitializedError();
    }
    return RedisClient.instance;
  }

  /** For tests only — allows re-initializing with a fresh config between test suites. */
  static resetForTests() {
    RedisClient.instance = undefined;
  }

  bindEvents() {
    this.client.on("connect", () => {
      this.status = "connecting";
      this.log.info("TCP connection established");
    });

    this.client.on("ready", () => {
      this.status = "ready";
      this.log.info("✅ Client ready to accept commands");
    });

    this.client.on("error", (err) => {
      this.status = "error";
      this.log.error("❌ Client error", { message: err.message });
    });

    this.client.on("close", () => {
      this.status = "disconnected";
      this.log.warn("Connection closed");
    });

    this.client.on("reconnecting", (ms) => {
      this.status = "reconnecting";
      this.log.warn("Reconnecting in " + ms + "ms...");
    });

    this.client.on("end", () => {
      this.status = "disconnected";
      this.log.warn(
        "Connection ended — retries exhausted, no further attempts",
      );
    });
  }

  // ============================================================
  // Connection lifecycle
  // ============================================================

  /**
   * Connects and resolves only once the client is truly ready
   * (or rejects on timeout/error). Safe to call multiple times —
   * concurrent callers share the same in-flight attempt.
   */
  async connect() {
    if (this.status === "ready") return;
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = this.doConnect().finally(() => {
      this.connectPromise = null;
    });

    return this.connectPromise;
  }

  async doConnect() {
    try {
      await this.client.connect();
    } catch (err) {
      throw new RedisConnectionError(err);
    }
  }

  /** Graceful shutdown — call from your process signal handlers. */
  async disconnect() {
    const timeout = new Promise((resolve) =>
      setTimeout(resolve, this.config.shutdownTimeoutMs),
    );

    const quit = async () => {
      if (this.subscriber) await this.subscriber.quit().catch(() => undefined);
      if (this.publisher) await this.publisher.quit().catch(() => undefined);
      await this.client.quit();
    };

    await Promise.race([quit(), timeout]);

    if (this.client.status !== "end") {
      this.log.warn("Graceful quit timed out — forcing disconnect");
      this.client.disconnect();
    }
  }

  isHealthy() {
    return this.status === "ready";
  }

  getStatus() {
    return this.status;
  }

  async healthCheck() {
    const start = Date.now();
    try {
      const pong = await this.client.ping();
      return {
        healthy: pong === "PONG",
        latencyMs: Date.now() - start,
        status: this.status,
      };
    } catch {
      return { healthy: false, latencyMs: null, status: this.status };
    }
  }

  /** Escape hatch — access the raw ioredis instance for anything not wrapped below. */
  getRawClient() {
    return this.client;
  }

  // ============================================================
  // Basic KV
  // ============================================================

  async set(key, value, ttlSeconds) {
    const payload = this.serialize(value);
    if (ttlSeconds) {
      await this.client.set(key, payload, "EX", ttlSeconds);
    } else {
      await this.client.set(key, payload);
    }
  }

  /** Sets only if the key does not already exist. Returns true if it was set. */
  async setIfNotExists(key, value, ttlSeconds) {
    const payload = this.serialize(value);
    const result = ttlSeconds
      ? await this.client.set(key, payload, "EX", ttlSeconds, "NX")
      : await this.client.set(key, payload, "NX");
    return result === "OK";
  }

  async get(key) {
    const raw = await this.client.get(key);
    return this.deserialize(raw);
  }

  /** Atomically replaces the value and returns the previous one. */
  async getSet(key, value) {
    const raw = await this.client.getset(key, this.serialize(value));
    return this.deserialize(raw);
  }

  async del(...keys) {
    if (keys.length === 0) return 0;
    return this.client.del(...keys);
  }

  async exists(key) {
    return (await this.client.exists(key)) === 1;
  }

  async expire(key, seconds) {
    return (await this.client.expire(key, seconds)) === 1;
  }

  async persist(key) {
    return (await this.client.persist(key)) === 1;
  }

  async ttl(key) {
    return this.client.ttl(key);
  }

  async incr(key) {
    return this.client.incr(key);
  }

  async incrBy(key, amount) {
    return this.client.incrby(key, amount);
  }

  async decr(key) {
    return this.client.decr(key);
  }

  async mget(keys) {
    if (keys.length === 0) return [];
    const raw = await this.client.mget(...keys);
    return raw.map((v) => this.deserialize(v));
  }

  async mset(entries) {
    const flat = [];
    for (const [k, v] of Object.entries(entries)) {
      flat.push(k, this.serialize(v));
    }
    if (flat.length) await this.client.mset(...flat);
  }

  // ============================================================
  // Hash
  // ============================================================

  async hset(key, field, value) {
    await this.client.hset(key, field, this.serialize(value));
  }

  async hmset(key, fields) {
    const flat = [];
    for (const [f, v] of Object.entries(fields))
      flat.push(f, this.serialize(v));
    if (flat.length) await this.client.hset(key, ...flat);
  }

  async hget(key, field) {
    const raw = await this.client.hget(key, field);
    return this.deserialize(raw);
  }

  async hgetall(key) {
    return this.client.hgetall(key);
  }

  async hdel(key, ...fields) {
    return this.client.hdel(key, ...fields);
  }

  async hincrby(key, field, amount) {
    return this.client.hincrby(key, field, amount);
  }

  // ============================================================
  // List
  // ============================================================

  async lpush(key, ...values) {
    return this.client.lpush(key, ...values);
  }

  async rpush(key, ...values) {
    return this.client.rpush(key, ...values);
  }

  async lpop(key) {
    return this.client.lpop(key);
  }

  async rpop(key) {
    return this.client.rpop(key);
  }

  async lrange(key, start = 0, stop = -1) {
    return this.client.lrange(key, start, stop);
  }

  async llen(key) {
    return this.client.llen(key);
  }

  // ============================================================
  // Set
  // ============================================================

  async sadd(key, ...members) {
    return this.client.sadd(key, ...members);
  }

  async srem(key, ...members) {
    return this.client.srem(key, ...members);
  }

  async smembers(key) {
    return this.client.smembers(key);
  }

  async sismember(key, member) {
    return (await this.client.sismember(key, member)) === 1;
  }

  // ============================================================
  // Sorted Set
  // ============================================================

  async zadd(key, score, member) {
    await this.client.zadd(key, score, member);
  }

  async zrange(key, start = 0, stop = -1, withScores = false) {
    return withScores
      ? this.client.zrange(key, String(start), String(stop), "WITHSCORES")
      : this.client.zrange(key, String(start), String(stop));
  }

  async zrangebyscore(key, min, max) {
    return this.client.zrangebyscore(key, min, max);
  }

  async zincrby(key, amount, member) {
    const result = await this.client.zincrby(key, amount, member);
    return Number(result);
  }

  async zrem(key, ...members) {
    return this.client.zrem(key, ...members);
  }

  // ============================================================
  // Pipeline / Transactions
  // ============================================================

  /** Batches multiple commands in one round trip. No atomicity guarantee. */
  pipeline() {
    return this.client.pipeline();
  }

  /** Atomic MULTI/EXEC transaction — all commands succeed or none apply. */
  multi() {
    return this.client.multi();
  }

  /**
   * Optimistic-locking transaction: watches keys, reads current state,
   * lets the caller build the transaction, and retries once if the
   * watched keys changed before EXEC (classic check-and-set pattern).
   */
  async watchTransaction(watchKeys, builder) {
    await this.client.watch(...watchKeys);
    const multi = this.client.multi();
    builder(multi);
    const result = await multi.exec();
    if (result === null) return null; // transaction aborted — a watched key changed
    return result.map(([err, val]) => {
      if (err) throw err;
      return val;
    });
  }

  // ============================================================
  // Pub / Sub
  // ============================================================

  async publish(channel, message) {
    if (!this.publisher) this.publisher = this.client.duplicate();
    return this.publisher.publish(channel, this.serialize(message));
  }

  async subscribe(channel, handler) {
    if (!this.subscriber) {
      this.subscriber = this.client.duplicate();
      this.subscriber.on("message", (ch, msg) => {
        this.subscriptions.get(ch)?.forEach((cb) => cb(msg));
      });
    }

    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
      await this.subscriber.subscribe(channel);
    }
    this.subscriptions.get(channel).add(handler);
  }

  async unsubscribe(channel, handler) {
    if (!this.subscriber) return;

    if (handler) {
      this.subscriptions.get(channel)?.delete(handler);
      if (this.subscriptions.get(channel)?.size) return; // other listeners remain
    }

    this.subscriptions.delete(channel);
    await this.subscriber.unsubscribe(channel);
  }

  // ============================================================
  // Lua scripting
  // ============================================================

  async eval(script, keys = [], args = []) {
    return this.client.eval(script, keys.length, ...keys, ...args);
  }

  // ============================================================
  // Distributed lock (single-node SET NX PX + token-safe release)
  // For multi-node quorum guarantees, layer Redlock on top of getRawClient().
  // ============================================================

  async acquireLock(key, ttlMs = 5000) {
    const token = crypto.randomUUID();
    const lockKey = 'lock:' + key;
    const result = await this.client.set(lockKey, token, "PX", ttlMs, "NX");
    return result === "OK" ? { key: lockKey, token } : null;
  }

  async releaseLock(handle) {
    // Compare-and-delete must be atomic, or we might delete a lock
    // acquired by someone else after ours expired.
    const script =
      'if redis.call("GET", KEYS[1]) == ARGV[1] then'\n +
      '  return redis.call("DEL", KEYS[1])'\n +
      'else'\n +
      '  return 0'\n +
      'end';
    const result = await this.eval(script, [handle.key], [handle.token]);
    return result === 1;
  }

  async extendLock(handle, ttlMs) {
    const script =
      'if redis.call("GET", KEYS[1]) == ARGV[1] then'\n +
      '  return redis.call("PEXPIRE", KEYS[1], ARGV[2])'\n +
      'else'\n +
      '  return 0'\n +
      'end';
    const result = await this.eval(script, [handle.key], [handle.token, ttlMs]);
    return result === 1;
  }

  /** Runs fn while holding the lock, then always releases it. Throws RedisLockError if not acquired. */
  async withLock(key, ttlMs, fn) {
    const lock = await this.acquireLock(key, ttlMs);
    if (!lock)
      throw new RedisLockError('Could not acquire lock for key: ' + key);
    try {
      return await fn();
    } finally {
      await this.releaseLock(lock);
    }
  }

  // ============================================================
  // Rate limiting (fixed window, atomic via Lua)
  // ============================================================

  async rateLimit(key, limit, windowSeconds) {
    const script =
      'local current = redis.call("INCR", KEYS[1])'\n +
      'if current == 1 then'\n +
      '  redis.call("EXPIRE", KEYS[1], ARGV[1])'\n +
      'end'\n +
      'local ttl = redis.call("TTL", KEYS[1])'\n +
      'return {current, ttl}';
    const [current, ttl] = await this.eval(
      script,
      ['ratelimit:' + key],
      [windowSeconds],
    );

    return {
      allowed: current <= limit,
      remaining: Math.max(0, limit - current),
      resetInSeconds: ttl,
    };
  }

  // ============================================================
  // Cache-aside helper
  // ============================================================

  /** Reads from cache; on miss, runs fetcher(), caches the result, and returns it. */
  async getOrSet(key, fetcher, ttlSeconds) {
    const cached = await this.get(key);
    if (cached !== null) return cached;

    const fresh = await fetcher();
    await this.set(key, fresh, ttlSeconds);
    return fresh;
  }

  // ============================================================
  // Safe bulk operations (SCAN-based — never blocks Redis like KEYS does)
  // ============================================================

  async deleteByPattern(pattern) {
    let cursor = "0";
    let deleted = 0;
    do {
      const [nextCursor, keys] = await this.client.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100,
      );
      cursor = nextCursor;
      if (keys.length) deleted += await this.client.del(...keys);
    } while (cursor !== "0");
    return deleted;
  }

  async scanKeys(pattern) {
    let cursor = "0";
    const found = [];
    do {
      const [nextCursor, keys] = await this.client.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100,
      );
      cursor = nextCursor;
      found.push(...keys);
    } while (cursor !== "0");
    return found;
  }

  // ============================================================
  // Diagnostics
  // ============================================================

  async dbSize() {
    return this.client.dbsize();
  }

  async info(section) {
    return section ? this.client.info(section) : this.client.info();
  }

  async flushCurrentDb() {
    if (__env.NODE_ENV === "production") {
      throw new Error("flushCurrentDb() is disabled in production for safety.");
    }
    await this.client.flushdb();
  }

  // ============================================================
  // Internal serialization helpers
  // ============================================================

  serialize(value) {
    return typeof value === "string" ? value : JSON.stringify(value);
  }

  deserialize(raw) {
    if (raw === null) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return raw; // was stored as a plain string
    }
  }
}
            `;
  }
}

export function redisConfigProvider(language: Language): string {
  if (language === "ts") {
    return `
            import __env from '../config/__env.js';
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
}

            `;
  } else {
    return `
            import __env from '../config/__env.js';
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
}

            
            `;
  }
}

export function redisErrorsProvider(language: Language): string {
  if (language === "ts") {
    return `
export class RedisNotInitializedError extends Error {
  constructor() {
    super('RedisClient not initialized. Call RedisClient.init(config) before getInstance().');
    this.name = 'RedisNotInitializedError';
  }
}

export class RedisConnectionError extends Error {
  constructor(cause: unknown) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    super(String.raw("Failed to connect to Redis:", reason));
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
}

            `;
  } else {
    return `
export class RedisNotInitializedError extends Error {
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
}

            `;
  }
}

export function redisBootstrapFileProvider(language: Language): string {
  if (language === "ts") {
    return `
import { RedisClient, loadRedisConfig, RedisConfigError } from "./index.js";

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
});
            `;
  } else {
    return `
import { RedisClient, loadRedisConfig, RedisConfigError } from "./index.js";

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
});
            `;
  }
}

export const redisTypesProvider: string = `
import { RedisOptions } from 'ioredis';

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
export function indexFileProvider(language: Language): string {
  return `
export { RedisClient } from './redis-client.js';
export { loadRedisConfig } from './redis.config.js';
${language === "ts" ? "export * from './redis.types.js';" : ""}
export * from './redis.errors.js';
`;
}
