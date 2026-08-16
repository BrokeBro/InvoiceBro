import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // The PDF templates render with @react-pdf/renderer, whose <Image> is a PDF
    // primitive, not an HTML <img>. The jsx-a11y rules assume the DOM and there
    // is no accessibility tree in a PDF for an alt attribute to reach.
    files: ["src/lib/pdf/templates/**/*.tsx"],
    rules: { "jsx-a11y/alt-text": "off" },
  },
]);

export default eslintConfig;
