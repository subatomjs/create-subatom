import { defineConfig } from "subatom";

export default defineConfig({
      port: 8080,
      host: "localhost",
      outDir: "build",
      sourcemap: true,
      minify: true,
      entry:"main.ts",
      watch: {
          extensions: ["ts", "tsx", "js", "jsx"],
          debounceMs: 500,
          ignore: ["**/logs/**"],
      }
});