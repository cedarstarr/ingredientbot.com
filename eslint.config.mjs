import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // eslint 10 removed context.getFilename(); eslint-plugin-react@7.37.5 (bundled by
  // eslint-config-next) still calls it during React-version auto-detect. Pinning the
  // version skips that path. Remove once eslint-config-next ships an eslint-10-safe plugin.
  { settings: { react: { version: "19.2" } } },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
