import { copy } from "fs-extra";

await copy("templates", "dist/templates", {
  overwrite: true,
  errorOnExist: false,
});