/// <reference types="node" />

const environment = {
    DATABASE_URL: process.env.DATABASE_URL || "",
    PORT: Number(process.env.PORT) || 8080,
    HOST: process.env.HOST || "localhost",

}
const __env = Object.freeze(environment);
export default __env;