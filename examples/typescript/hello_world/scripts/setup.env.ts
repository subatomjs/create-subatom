/// <reference types="node" />
import * as fs from "fs";

const source = ".env.requirements";
const destination = ".env";

if (!fs.existsSync(destination)) {
  fs.copyFileSync(source, destination);
  console.log("✅ Created .env from .env.requirements");
} else {
  console.log("ℹ️ .env already exists");
}