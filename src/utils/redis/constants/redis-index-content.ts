// redis-index-content.ts
import type { Language } from "../../../types.js";

function indexFileContent(language: Language): string {
  return `export { RedisClient } from './redis-client.js';
export { loadRedisConfig } from './redis.config.js';
${language === "ts" ? "export * from './redis.types.js';" : ""}
export * from './redis.errors.js';
`;
}

export default indexFileContent