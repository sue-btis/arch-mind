import { cp, rm } from "node:fs/promises";
import { build } from "esbuild";

await build({
  entryPoints: ["src/cli.ts"],
  outfile: "dist/cli.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  banner: {
    js: '#!/usr/bin/env node\nimport { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
  },
});
await rm("dist/ui", { recursive: true, force: true });
await cp("../ui/dist", "dist/ui", { recursive: true });
