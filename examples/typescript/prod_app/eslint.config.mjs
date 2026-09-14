import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    //Add your custom config...
  },
  {
    ignores: ["dist/**", "node_modules/**", "build/**"],
  },
);
