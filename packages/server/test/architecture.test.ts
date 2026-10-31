import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const packagesDir = fileURLToPath(new URL("../../", import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (["node_modules", "dist"].includes(name)) return [];
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx|mjs|js)$/.test(name) ? [full] : [];
  });
}

const packages = readdirSync(packagesDir).filter((n) => statSync(join(packagesDir, n)).isDirectory());

describe("architecture rules", () => {
  it("TST-005: only the rules package depends on or imports the YAML parser", () => {
    const offenders: string[] = [];
    for (const pkg of packages) {
      const manifest = JSON.parse(readFileSync(join(packagesDir, pkg, "package.json"), "utf8"));
      const deps = { ...manifest.dependencies, ...manifest.devDependencies };
      if (pkg !== "rules" && ("yaml" in deps || "js-yaml" in deps || "gray-matter" in deps)) {
        offenders.push(`${pkg}/package.json`);
      }
      if (pkg === "rules") continue;
      for (const file of sourceFiles(join(packagesDir, pkg))) {
        if (/from\s+["'](yaml|js-yaml|gray-matter)["']|require\(["'](yaml|js-yaml|gray-matter)["']\)/.test(readFileSync(file, "utf8"))) {
          offenders.push(relative(packagesDir, file));
        }
      }
    }
    expect(packages).toContain("rules");
    expect(offenders).toEqual([]);
  });

  it("TST-006: the local server and the UI import only file-reading APIs", () => {
    // An allowlist, so a new import style (default, namespace, dynamic, require) fails instead of slipping past.
    const readers = new Set(["readFile", "readFileSync", "readdir", "readdirSync", "access", "stat", "statSync", "existsSync"]);
    const fsModule = String.raw`["'](?:node:)?fs(?:\/promises)?["']`;
    const anyFsImport = new RegExp(String.raw`import\s+([^;]*?)\s+from\s+${fsModule}|import\(\s*${fsModule}\s*\)|require\(\s*${fsModule}\s*\)`, "g");
    const offenders: string[] = [];
    for (const pkg of ["server", "ui"]) {
      for (const file of sourceFiles(join(packagesDir, pkg, "src"))) {
        const text = readFileSync(file, "utf8");
        for (const m of text.matchAll(anyFsImport)) {
          const named = /^(?:type\s+)?\{([^}]*)\}$/.exec((m[1] ?? "").trim());
          const names = named ? named[1]!.split(",").map((n) => n.trim().split(/\s+as\s+/)[0]!).filter(Boolean) : [];
          if (!named || names.some((n) => !readers.has(n))) offenders.push(`${relative(packagesDir, file)}: ${m[0]}`);
        }
        if (/\bsetupStore\b|\bsaveConcept\b|\bwriteConceptAtomic\b/.test(text) && !file.endsWith("cli.ts")) {
          offenders.push(`${relative(packagesDir, file)} (calls a rules writer)`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
