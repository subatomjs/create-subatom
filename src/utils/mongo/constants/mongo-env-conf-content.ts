import { Language } from "../../../types.js";

const mongoEnvConfigFileContent = (fileType: Language, useRedis:boolean) => {
  if (fileType === "ts") {
    return `/// <reference types="node" />
import {configEnv} from 'subatom'
configEnv()


const environment = {
    MONGO_CONNECTION_STRING: process.env.MONGO_CONNECTION_STRING as string || "",
    NODE_ENV: process.env.NODE_ENV as string || "",
    PORT: Number(process.env.PORT) || 8080,
    HOST: process.env.HOST as string || "localhost",
    ${useRedis === true ? "REDIS_URL: process.env.REDIS_URL as string || '',": ""}
    ${useRedis === true ? "REDIS_KEY_PREFIX: process.env.REDIS_KEY_PREFIX as string || '',": ""}
    ${useRedis === true ? "REDIS_REQUIRED: process.env.REDIS_REQUIRED as string || '',": ""}
    ${useRedis === true ? "REDIS_CONNECT_TIMEOUT_MS: process.env.REDIS_CONNECT_TIMEOUT_MS as string || '',": ""}
    ${useRedis === true ? "REDIS_SHUTDOWN_TIMEOUT_MS: process.env.REDIS_SHUTDOWN_TIMEOUT_MS as string || '',": ""}
    ${useRedis === true ? "REDIS_DEBUG: process.env.REDIS_DEBUG as string || ''": ""}
}
const __env = Object.freeze(environment);
export default __env;
`;
  } else {
    return `import {configEnv} from 'subatom'
configEnv()


const environment = {
    MONGO_CONNECTION_STRING: process.env.MONGO_CONNECTION_STRING || "",
    NODE_ENV: process.env.NODE_ENV || "",
    PORT: Number(process.env.PORT) || 8080,
    HOST: process.env.HOST || "localhost",
    ${useRedis === true ? "REDIS_URL: process.env.REDIS_URL || '',": ""}
    ${useRedis === true ? "REDIS_KEY_PREFIX: process.env.REDIS_KEY_PREFIX || '',": ""}
    ${useRedis === true ? "REDIS_REQUIRED: process.env.REDIS_REQUIRED || '',": ""}
    ${useRedis === true ? "REDIS_CONNECT_TIMEOUT_MS: process.env.REDIS_CONNECT_TIMEOUT_MS || '',": ""}
    ${useRedis === true ? "REDIS_SHUTDOWN_TIMEOUT_MS: process.env.REDIS_SHUTDOWN_TIMEOUT_MS || '',": ""}
    ${useRedis === true ? "REDIS_DEBUG: process.env.REDIS_DEBUG || ''": ""}

}
const __env = Object.freeze(environment);
export default __env;
    `;
  }
};

export default mongoEnvConfigFileContent