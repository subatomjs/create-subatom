
      import { defineConfig } from "subatom";

      export default defineConfig({
             port: 8080,
             host: "localhost",
             outDir: "build",
             entry:"main.js",
             watch: {
                    extensions: ["js", "jsx"],
                    debounceMs: 500,
                    ignore: ["**/logs/**"],
        }
      });
    