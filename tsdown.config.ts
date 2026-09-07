import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    "bin/create": "src/bin/create.ts",
  },

  outDir: "dist",

  format: ["esm"],

  target: "node24",

  dts: true,

  // Preserve the source/module structure
  unbundle: true,

  // Custom output extensions
  outExtensions() {
    return {
      js: ".js",
      dts: ".d.ts",
    };
  },

  sourcemap: true,

  clean: true,

  treeshake: true,

  minify: false,

  deps: {
    neverBundle: true,
  },
});
