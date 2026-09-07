function redisEnvConfigFileContent(language: "ts" | "js"):string{

    if(language === "ts"){
        return `/// <reference types="node" />
import {configEnv} from 'subatom'
configEnv()


const environment = {
    NODE_ENV: process.env.NODE_ENV as string || "",
    PORT: Number(process.env.PORT) || 8080,
    HOST: process.env.HOST as string || "localhost",
    REDIS_URL: process.env.REDIS_URL as string || '',
    REDIS_KEY_PREFIX: process.env.REDIS_KEY_PREFIX as string || '',
    REDIS_REQUIRED: process.env.REDIS_REQUIRED as string || '',
    REDIS_CONNECT_TIMEOUT_MS: process.env.REDIS_CONNECT_TIMEOUT_MS as string || '',
    REDIS_SHUTDOWN_TIMEOUT_MS: process.env.REDIS_SHUTDOWN_TIMEOUT_MS as string || '',
    REDIS_DEBUG: process.env.REDIS_DEBUG as string || ''
}
const envConfig = Object.freeze(environment);
export default envConfig;`
    }else{
                return `import {configEnv} from 'subatom'
configEnv()


const environment = {
    NODE_ENV: process.env.NODE_ENV,
    PORT: Number(process.env.PORT),
    HOST: process.env.HOST,
    REDIS_URL: process.env.REDIS_URL,
    REDIS_KEY_PREFIX: process.env.REDIS_KEY_PREFIX,
    REDIS_REQUIRED: process.env.REDIS_REQUIRED,
    REDIS_CONNECT_TIMEOUT_MS: process.env.REDIS_CONNECT_TIMEOUT_MS,
    REDIS_SHUTDOWN_TIMEOUT_MS: process.env.REDIS_SHUTDOWN_TIMEOUT_MS,
    REDIS_DEBUG: process.env.REDIS_DEBUG
}
const envConfig = Object.freeze(environment);
export default envConfig;`
    }


}

export default redisEnvConfigFileContent