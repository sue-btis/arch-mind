import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { StoreError, loadConfig, loadFacets, setupStore } from "@arch-mind/rules";
import { startServer } from "./app.ts";

const DEFAULT_PORT = 4417;

async function main(args: string[]) {
  if (args[0] === "setup") {
    const folder = args[1];
    if (!folder) throw new StoreError("Usage: arch-mind setup <folder>");
    const storePath = await setupStore(folder);
    console.log(
      `Store ready at ${storePath}. Back this folder up (for example as a Git repository) before capturing. ` +
        "Keep it on a local NTFS drive: saves use hard links, which FAT32/exFAT drives and some network or virtual sync drives do not support.",
    );
    return;
  }
  if (args.length > 0) throw new StoreError("Usage: arch-mind [setup <folder>]");

  const { storePath } = await loadConfig();
  await loadFacets(storePath);
  const uiDir = join(dirname(fileURLToPath(import.meta.url)), "ui");
  const { port } = await startServer({ storePath, uiDir, port: DEFAULT_PORT });
  console.log(`arch-mind is running at http://127.0.0.1:${port}`);
}

main(process.argv.slice(2)).catch((error) => {
  console.error(error instanceof StoreError ? error.message : error);
  process.exit(1);
});
