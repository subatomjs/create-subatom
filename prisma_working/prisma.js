
import { createRequire } from "module";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import __env from "./src/config/__env.js";

const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");

const { Pool } = pg;

const pool = new Pool({
  connectionString: __env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: ["warn", "error"],
});

export default prisma;

      