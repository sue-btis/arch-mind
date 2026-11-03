import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LAYERS, PICTOGRAMS } from "@arch-mind/rules";

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
        if (/\bsetupStore\b|\bsaveConcept\b|\bwriteConceptAtomic\b|\breplaceConceptAtomic\b|\bextendConcept\b|\bwriteIllustrationAtomic\b/.test(text) && !file.endsWith("cli.ts")) {
          offenders.push(`${relative(packagesDir, file)} (calls a rules writer)`);
        }
        if (/\bappendReviewLine\b|\brecordReview\b/.test(text) && !file.endsWith("app.ts")) {
          offenders.push(`${relative(packagesDir, file)} (calls the review log writer outside app.ts)`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("TST-017: no code path other than the append-mode writer opens reviews.jsonl for writing", () => {
    const touching = packages
      .flatMap((pkg) => sourceFiles(join(packagesDir, pkg, "src")))
      .filter((f) => readFileSync(f, "utf8").includes("reviews.jsonl"))
      .map((f) => relative(packagesDir, f).replaceAll("\\", "/"))
      .sort();
    expect(touching).toEqual(["rules/src/reviews.ts", "rules/src/store.ts"]);

    const reviewsSource = readFileSync(join(packagesDir, "rules", "src", "reviews.ts"), "utf8");
    expect(reviewsSource.match(/\bopen\(.*\);/g)).toEqual(['open(join(storePath, "reviews.jsonl"), "a+");']);
    expect(reviewsSource).not.toMatch(/\b(writeFile|appendFile|rename|truncate|unlink|rm)\b/);

    const storeSource = readFileSync(join(packagesDir, "rules", "src", "store.ts"), "utf8");
    expect(storeSource.match(/writeFile\(reviewsFile[^)]*\)/g)).toEqual(['writeFile(reviewsFile, "", { flag: "wx" })']);
  });

  it("TST-024: @xyflow/react is not a UI dependency and no UI source imports it", () => {
    const manifest = JSON.parse(readFileSync(join(packagesDir, "ui", "package.json"), "utf8"));
    const deps = { ...manifest.dependencies, ...manifest.devDependencies, ...manifest.peerDependencies };
    expect(Object.keys(deps).filter((name) => name.startsWith("@xyflow/"))).toEqual([]);
    const importers = sourceFiles(join(packagesDir, "ui", "src")).filter((file) => /@xyflow\//.test(readFileSync(file, "utf8")));
    expect(importers.map((f) => relative(packagesDir, f))).toEqual([]);
  });

  it("TST-025: the catalog ids and the artwork symbol ids are the same set and include the four layer ids", () => {
    const artwork = readFileSync(join(packagesDir, "ui", "src", "pictogram-art.tsx"), "utf8");
    const symbols = [...artwork.matchAll(/<symbol id="([^"]+)"/g)].map((m) => m[1]!);
    const catalog = PICTOGRAMS.map((p) => p.id);
    expect(new Set(symbols).size).toBe(symbols.length);
    expect([...symbols].sort()).toEqual([...catalog].sort());
    for (const layer of LAYERS) expect(symbols).toContain(layer);
  });

  it("TST-031: only the rules writers touch illustrations/, and the SVG is written before the concept file", () => {
    const writing = packages
      .flatMap((pkg) => sourceFiles(join(packagesDir, pkg, "src")))
      .filter((f) => /\bwriteIllustrationAtomic\b/.test(readFileSync(f, "utf8")))
      .map((f) => relative(packagesDir, f).replaceAll("\\", "/"))
      .sort();
    expect(writing).toEqual(["rules/src/illustration.ts", "rules/src/store.ts"]);

    const illustrationSource = readFileSync(join(packagesDir, "rules", "src", "illustration.ts"), "utf8");
    expect(illustrationSource.match(/(?<![.\w])(writeFile|rename|appendFile|truncate)\(/g)).toEqual(["rename("]);

    const storeSource = readFileSync(join(packagesDir, "rules", "src", "store.ts"), "utf8");
    const save = storeSource.slice(storeSource.indexOf("export async function saveConcept"), storeSource.indexOf("export type LoadOneOutcome"));
    expect(save.indexOf("writeIllustrationFirst(")).toBeGreaterThan(-1);
    expect(save.indexOf("writeIllustrationFirst(")).toBeLessThan(save.indexOf("writeConceptAtomic("));
    const extend = storeSource.slice(storeSource.indexOf("export async function extendConcept"), storeSource.indexOf("export async function loadIllustration"));
    expect(extend.indexOf("writeIllustrationFirst(")).toBeLessThan(extend.indexOf("replaceConceptAtomic("));

    for (const pkg of ["server", "ui"]) {
      for (const file of sourceFiles(join(packagesDir, pkg, "src"))) {
        expect(readFileSync(file, "utf8"), file).not.toMatch(/\b(writeFile|rename|mkdir|copyFile|createWriteStream)\b/);
      }
    }
  });

  it("TST-034: the UI never injects SVG text into the DOM and reaches an illustration only through an img", () => {
    const injectors = /dangerouslySetInnerHTML|\binnerHTML\b|\bouterHTML\b|insertAdjacentHTML|DOMParser|createContextualFragment|document\.write|srcdoc|<object\b|<embed\b|<iframe\b/;
    expect(injectors.test("<div dangerouslySetInnerHTML={{ __html: svg }} />")).toBe(true);
    const offenders: string[] = [];
    const illustrationUrls: string[] = [];
    for (const file of sourceFiles(join(packagesDir, "ui", "src"))) {
      const text = readFileSync(file, "utf8");
      const name = relative(packagesDir, file).replaceAll("\\", "/");
      if (injectors.test(text)) offenders.push(name);
      if (/fetch\s*\([^)]*illustration/.test(text)) offenders.push(`${name} (fetches the illustration as data)`);
      for (const m of text.matchAll(/src=\{`[^`]*\/illustration`\}/g)) illustrationUrls.push(`${name}: ${m[0]}`);
      if (/\/illustration`/.test(text) && !/<img[\s\S]{0,200}\/illustration`/.test(text)) offenders.push(`${name} (illustration URL outside an img)`);
    }
    expect(offenders).toEqual([]);
    expect(illustrationUrls).toHaveLength(1);
  });

  it("TST-039: the finder, legend filter, focus, facet search, grouping and prominence modules never write or keep state outside memory", () => {
    const navigationModules = [
      "ui/src/finder.ts",
      "ui/src/Finder.tsx",
      "ui/src/prominence.ts",
      "ui/src/Sidebar.tsx",
      "ui/src/focus.ts",
      "ui/src/FocusPill.tsx",
      "ui/src/FitMessage.tsx",
      "ui/src/facet-search.ts",
      "ui/src/grouping.ts",
      "ui/src/grouped-layout.ts",
      "ui/src/grouped-scene.ts",
      "ui/src/GroupPill.tsx",
    ];
    const nonGetFetch = /\bfetch\s*\([^)]*\bmethod\s*:\s*["'`](?!get["'`])/i;
    const browserStorage = /\b(localStorage|sessionStorage|indexedDB)\b/;
    const violations = (text: string) => [nonGetFetch.test(text) && "non-GET fetch", browserStorage.test(text) && "browser storage"].filter(Boolean);

    expect(violations('fetch("/api/x", { method: "POST" })')).toEqual(["non-GET fetch"]);
    expect(violations('fetch("/api/x", { method: "GET" })')).toEqual([]);
    expect(violations("window.localStorage.setItem(a, b)")).toEqual(["browser storage"]);

    const offenders = navigationModules.flatMap((module) => violations(readFileSync(join(packagesDir, module), "utf8")).map((v) => `${module}: ${v}`));
    expect(offenders).toEqual([]);
  });
});
