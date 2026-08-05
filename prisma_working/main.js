//! Adjust path according to your project if mismatch..  
import __env from "./src/config/__env.js";
import server from "./src/server.js";
import prisma from "./prisma.js";

async function main() {
    try {
        await prisma.$connect();
        console.log("✅ Connected to postgresql (Prisma) successfully");

        // Server listen
        server.listen(__env.PORT || 8080, __env.HOST, "prisma_working");
    } catch (error) {
        console.error("❌ Failed to connect to postgresql:", error);
        process.exit(1);
    }
}

await main();
