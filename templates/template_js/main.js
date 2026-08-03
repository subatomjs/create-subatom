import __env from "./src/config/__env.js";
import server from "./src/server.js";

async function main() {
  server.listen(__env.PORT, __env.HOST, "test_pack");
}

await main();
