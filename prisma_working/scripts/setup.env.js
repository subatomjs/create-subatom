
/// <reference types="node" />
import * as fs from "fs";

const source = ".env.requirement";
const destination = ".env";

if (!fs.existsSync(destination)) {
  fs.copyFileSync(source, destination);
  console.log("✅ Created .env from .env.requirement");
} else {
  console.log("ℹ️ .env already exists");
}
    
    