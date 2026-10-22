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
    // Vendored third-party components (beui.dev, MIT): kept as published.
    "src/components/motion/**",
    "src/components/charts/**",
    "src/lib/hooks/**",
    "src/lib/ease.ts",
    "src/lib/touch.ts",
    "src/lib/presence-gate.tsx",
    "src/lib/text-shimmer.ts",
    "src/lib/tick-sound.ts",
    "src/lib/command-search.ts",
  ]),
]);

export default eslintConfig;
