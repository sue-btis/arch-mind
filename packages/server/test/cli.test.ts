import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { configFilePath } from "@arch-mind/rules";

const cli = fileURLToPath(new URL("../dist/cli.mjs", import.meta.url));

let home: string;
const env = () => ({ USERPROFILE: home, HOME: home, PATH: process.env.PATH ?? "" });
const run = (...args: string[]) => spawnSync(process.execPath, [cli, ...args], { env: env(), encoding: "utf8", timeout: 20000 });

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "arch-mind-cli-"));
});
afterEach(() => rm(home, { recursive: true, force: true }));

function start() {
  const child = spawn(process.execPath, [cli], { env: env(), stdio: ["ignore", "pipe", "pipe"] });
  const url = new Promise<string>((resolve, reject) => {
    child.stdout.on("data", (chunk: Buffer) => {
      const match = /running at (http:\/\/127\.0\.0\.1:\d+)/.exec(chunk.toString());
      if (match) resolve(match[1]!);
    });
    child.on("exit", (code) => reject(new Error(`exited with ${code}`)));
  });
  return { child, url };
}

describe("arch-mind command (R-5, AC-5, AC-6)", () => {
  it("exits naming the config path when setup has not run", () => {
    const result = run();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(configFilePath(home));
  });

  it("setup writes the config and the store, then start serves the empty store", async () => {
    const folder = join(home, "store");
    expect(run("setup", folder).status).toBe(0);
    expect(JSON.parse(await readFile(configFilePath(home), "utf8"))).toEqual({ storePath: folder });

    const { child, url } = start();
    try {
      const base = await url;
      const res = await fetch(`${base}/api/concepts`);
      expect(await res.json()).toEqual({ concepts: [], problems: [] });
    } finally {
      child.kill();
    }
  });

  it("exits naming facets.yaml when the catalog is missing at start", async () => {
    const folder = join(home, "store");
    run("setup", folder);
    await rm(join(folder, "facets.yaml"));
    const result = run();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(join(folder, "facets.yaml"));
  });

  it("refuses to run setup over an existing store", () => {
    const folder = join(home, "store");
    run("setup", folder);
    const again = run("setup", folder);
    expect(again.status).toBe(1);
    expect(again.stderr).toContain("already exists");
  });
});
