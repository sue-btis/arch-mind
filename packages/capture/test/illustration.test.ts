import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PICTOGRAMS, configFilePath, setupStore, validateSvg } from "@arch-mind/rules";
import { runTool } from "../src/tools.ts";

const serverFile = fileURLToPath(new URL("../dist/server.mjs", import.meta.url));
const docs = new URL("../../../docs/design/", import.meta.url);
const readJson = async (rel: string) => JSON.parse(await readFile(new URL(rel, docs), "utf8"));
const contract = await readJson("api/capture-tools.schema.json");

const ajv = addFormats(new Ajv2020({ allErrors: true, strict: false }));
ajv.addSchema(await readJson("data/concept.schema.json"));
ajv.addSchema(contract);
const schemaAt = (pointer: string) => {
  const validate = ajv.getSchema(`arch-mind/capture-tools.schema.json#${pointer}`);
  if (!validate) throw new Error(`schema not found: ${pointer}`);
  return validate;
};

const svg = (label: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><title>${label}</title><rect x="4" y="8" width="32" height="24" rx="3" fill="#cfe0ff" stroke="#223"/><path d="M4 8 L20 22 L36 8" fill="none" stroke="#223"/></svg>`;
const SCRIPTED = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';

let home: string;
let store: string;
let client: Client;

const concept = (over: Record<string, unknown> = {}) => ({
  id: "envelope",
  title: "Envelope",
  layer: "network",
  domains: ["web"],
  concerns: ["security"],
  seeI: { statement: "s", elaboration: "e", example: "x", illustration: "A sealed envelope." },
  relations: [],
  recall: [{ question: "What is it?" }],
  ...over,
});
const call = (name: string, args: unknown) => client.callTool({ name, arguments: args as Record<string, unknown> });
const errorsOf = (res: object) =>
  ((res as { structuredContent?: unknown }).structuredContent as { errors: { path: string; rule: string }[] }).errors.map((e) => `${e.rule}@${e.path}`).sort();

async function treeDigest(dir: string): Promise<string> {
  const hash = createHash("sha256");
  const walk = async (current: string) => {
    for (const name of (await readdir(current)).sort()) {
      const full = join(current, name);
      if ((await stat(full)).isDirectory()) await walk(full);
      else hash.update(full).update(await readFile(full));
    }
  };
  await walk(dir);
  return hash.digest("hex");
}

beforeAll(async () => {
  home = await mkdtemp(join(tmpdir(), "arch-mind-capture-illustration-"));
  store = join(home, "store");
  await setupStore(store, configFilePath(home));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverFile],
    env: { USERPROFILE: home, HOME: home, PATH: process.env.PATH ?? "" },
    stderr: "pipe",
  });
  client = new Client({ name: "illustration-contract-test", version: "0.0.0" });
  await client.connect(transport);
});

afterAll(async () => {
  await client.close();
  await rm(home, { recursive: true, force: true });
});

describe("published tool schemas follow capture-tools.schema.json (TST-030, AC-034 to AC-036)", () => {
  it("publishes the same property names as the contract for every tool", async () => {
    const { tools } = await client.listTools();
    const published = Object.fromEntries(tools.map((t) => [t.name, Object.keys((t.inputSchema as { properties: object }).properties).sort()]));
    const contractual = Object.fromEntries(
      Object.entries(contract.$defs.tools as Record<string, { inputSchema: { properties: object } }>).map(([name, t]) => [name, Object.keys(t.inputSchema.properties).sort()]),
    );
    expect(published).toEqual(contractual);
  });

  it("accepts contract-valid pictogram and illustration arguments and rejects a mistyped one", async () => {
    const { tools } = await client.listTools();
    const compile = (name: string) => ajv.compile(tools.find((t) => t.name === name)!.inputSchema as object);
    expect(compile("save_concept")(concept({ pictogram: "shield", illustration: svg("a") }))).toBe(true);
    expect(compile("save_concept")(concept({ illustration: "" }))).toBe(false);
    expect(compile("save_concept")(concept({ pictogram: "Not An Id" }))).toBe(false);
    expect(compile("extend_concept")({ id: "x", pictogram: "shield", illustration: svg("a") })).toBe(true);
    const preview = compile("preview_illustration");
    expect(preview({ id: "x", illustration: svg("a") })).toBe(true);
    expect(preview({ id: "x" })).toBe(false);
    expect(schemaAt("/$defs/tools/preview_illustration/inputSchema")({ id: "x", illustration: svg("a") })).toBe(true);
  });
});

describe("list_concepts, save_concept and extend_concept with a pictogram and an illustration (TST-030)", () => {
  it("lists the whole catalog, including the generic pictograms, matching the output schema", async () => {
    const res = await call("list_concepts", {});
    const validate = schemaAt("/$defs/tools/list_concepts/outputSchema");
    expect(validate(res.structuredContent), JSON.stringify(validate.errors)).toBe(true);
    expect((res.structuredContent as { pictograms: unknown }).pictograms).toEqual(PICTOGRAMS);
    const ids = PICTOGRAMS.map((p) => p.id);
    for (const generic of ["database", "message-queue", "background-worker", "mutex-lock", "encryption-key", "cache", "plugin-module", "tenant-building", "rate-gauge", "gateway"]) {
      expect(ids).toContain(generic);
    }
  });

  it("save_concept with both writes the SVG and one image link, and list_concepts then reports them", async () => {
    const res = await call("save_concept", concept({ pictogram: "shield", illustration: svg("saved") }));
    expect(res.isError).toBeFalsy();
    const validate = schemaAt("/$defs/tools/save_concept/outputSchema");
    expect(validate(res.structuredContent), JSON.stringify(validate.errors)).toBe(true);
    expect((res.structuredContent as { illustrationFile: string }).illustrationFile).toBe(join(store, "illustrations", "envelope.svg"));
    expect(await readFile(join(store, "illustrations", "envelope.svg"), "utf8")).toBe(svg("saved"));

    const listed = await call("list_concepts", {});
    expect(schemaAt("/$defs/tools/list_concepts/outputSchema")(listed.structuredContent)).toBe(true);
    expect((listed.structuredContent as { concepts: unknown[] }).concepts).toEqual([
      expect.objectContaining({ id: "envelope", pictogram: "shield", hasIllustration: true }),
    ]);
    const got = await call("get_concept", { id: "envelope" });
    expect(ajv.getSchema("arch-mind/concept.schema.json")!(got.structuredContent)).toBe(true);
  });

  it.each([
    ["unknown_pictogram", "/pictogram", concept({ id: "other", pictogram: "no-such-picture" })],
    ["invalid_illustration", "/illustration", concept({ id: "other", illustration: SCRIPTED })],
  ])("save_concept rejects %s at %s with a contract-valid rejection and writes nothing", async (rule, path, args) => {
    const before = await treeDigest(store);
    const res = await call("save_concept", args);
    expect(res.isError).toBe(true);
    const validate = schemaAt("/$defs/rejection");
    expect(validate(res.structuredContent), JSON.stringify(validate.errors)).toBe(true);
    expect(errorsOf(res)).toContain(`${rule}@${path}`);
    expect(await treeDigest(store)).toBe(before);
  });

  it("extend_concept answers already_present for a second pictogram or illustration and writes nothing", async () => {
    const before = await treeDigest(store);
    const res = await call("extend_concept", { id: "envelope", pictogram: "server", illustration: svg("again") });
    expect(res.isError).toBe(true);
    expect(schemaAt("/$defs/rejection")(res.structuredContent)).toBe(true);
    expect(errorsOf(res)).toEqual(["already_present@/illustration", "already_present@/pictogram"]);
    expect(await treeDigest(store)).toBe(before);
  });

  it("extend_concept adds a pictogram and an illustration to a concept that has none", async () => {
    await call("save_concept", concept({ id: "plain", title: "Plain" }));
    const res = await call("extend_concept", { id: "plain", pictogram: "cache", illustration: svg("late") });
    expect(res.isError).toBeFalsy();
    const validate = schemaAt("/$defs/tools/extend_concept/outputSchema");
    expect(validate(res.structuredContent), JSON.stringify(validate.errors)).toBe(true);
    const got = (await call("get_concept", { id: "plain" })).structuredContent as { pictogram: string; seeI: { illustration: string } };
    expect(got.pictogram).toBe("cache");
    expect(got.seeI.illustration).toBe("A sealed envelope.\n\n![Illustration of Plain](../illustrations/plain.svg)");
  });

  it("extend_concept rejects an invalid illustration and an unknown pictogram without writing", async () => {
    await call("save_concept", concept({ id: "bare", title: "Bare" }));
    const before = await treeDigest(store);
    const res = await call("extend_concept", { id: "bare", pictogram: "nope", illustration: SCRIPTED });
    expect(res.isError).toBe(true);
    expect(schemaAt("/$defs/rejection")(res.structuredContent)).toBe(true);
    expect(errorsOf(res)).toEqual(["invalid_illustration@/illustration", "unknown_pictogram@/pictogram"]);
    expect(await treeDigest(store)).toBe(before);
  });

  it("preview_illustration over the protocol rejects an invalid SVG without opening anything", async () => {
    const before = await treeDigest(store);
    const res = await call("preview_illustration", { id: "envelope", illustration: SCRIPTED });
    expect(res.isError).toBe(true);
    expect(schemaAt("/$defs/rejection")(res.structuredContent)).toBe(true);
    expect(errorsOf(res)).toEqual(expect.arrayContaining(["invalid_illustration@/illustration"]));
    expect(await treeDigest(store)).toBe(before);
  });
});

describe("preview_illustration (TST-030, AC-035)", () => {
  it("writes a page and an SVG copy outside the store, shows the SVG only through an img, opens the page and leaves the store byte-identical", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "arch-mind-preview-test-"));
    try {
      const opened: string[] = [];
      const before = await treeDigest(store);
      const res = await runTool(store, "preview_illustration", { id: "envelope", illustration: svg("preview") }, { tempRoot, openPage: async (file) => void opened.push(file) });
      expect(res?.isError).toBe(false);
      const validate = schemaAt("/$defs/tools/preview_illustration/outputSchema");
      expect(validate(res!.structured), JSON.stringify(validate.errors)).toBe(true);
      const page = (res!.structured as { previewPage: string }).previewPage;
      expect(opened).toEqual([page]);
      expect(resolve(page).startsWith(resolve(tempRoot))).toBe(true);
      expect(resolve(page).startsWith(resolve(store))).toBe(false);
      const html = await readFile(page, "utf8");
      expect(html).toMatch(/<img [^>]*src="illustration\.svg"/);
      expect(html).not.toMatch(/<svg/i);
      expect(html).not.toMatch(/<script/i);
      const copy = await readFile(join(dirname(page), "illustration.svg"), "utf8");
      expect(copy).toBe(svg("preview"));
      expect(validateSvg(copy)).toEqual([]);
      expect(await treeDigest(store)).toBe(before);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("rejects an invalid SVG as invalid_illustration, writes no page and does not open one", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "arch-mind-preview-test-"));
    try {
      const opened: string[] = [];
      const res = await runTool(store, "preview_illustration", { id: "envelope", illustration: SCRIPTED }, { tempRoot, openPage: async (file) => void opened.push(file) });
      expect(res?.isError).toBe(true);
      expect(schemaAt("/$defs/rejection")(res!.structured)).toBe(true);
      expect((res!.structured as { errors: { rule: string }[] }).errors.every((e) => e.rule === "invalid_illustration")).toBe(true);
      expect(opened).toEqual([]);
      expect(await readdir(tempRoot)).toEqual([]);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("rejects a malformed call as invalid_shape", async () => {
    const res = await runTool(store, "preview_illustration", { id: "Bad Id", illustration: svg("x"), extra: 1 }, { openPage: async () => {} });
    expect(res?.isError).toBe(true);
    expect((res!.structured as { errors: { rule: string }[] }).errors.map((e) => e.rule)).toEqual(["invalid_shape", "invalid_shape"]);
  });
});

describe("recorded capture walk-through (TST-035, AC-034, AC-041)", () => {
  const tempRootPromise = mkdtemp(join(tmpdir(), "arch-mind-walk-"));
  afterAll(async () => rm(await tempRootPromise, { recursive: true, force: true }));
  const preview = async (id: string, illustration: string) =>
    (await runTool(store, "preview_illustration", { id, illustration }, { tempRoot: await tempRootPromise, openPage: async () => {} }))!;

  it("saves only what the author accepted: a re-asked drawing replaces the first, a declined pictogram and a declined illustration are absent", async () => {
    const first = svg("first proposal");
    const second = svg("second proposal");
    expect((await preview("walk-accept", first)).isError).toBe(false);
    // The author asks again, so only the second drawing is previewed and accepted.
    expect((await preview("walk-accept", second)).isError).toBe(false);
    const accepted = await call("save_concept", concept({ id: "walk-accept", title: "Walk accept", pictogram: "shield", illustration: second }));
    expect(accepted.isError).toBeFalsy();
    // Pictogram declined, illustration accepted.
    expect((await call("save_concept", concept({ id: "walk-picture-only", title: "Walk picture only", illustration: first }))).isError).toBeFalsy();
    // Both declined.
    expect((await call("save_concept", concept({ id: "walk-decline", title: "Walk decline" }))).isError).toBeFalsy();

    const md = (id: string) => readFile(join(store, "concepts", `${id}.md`), "utf8");
    const acceptedText = await md("walk-accept");
    expect(acceptedText).toContain("pictogram: shield");
    expect(await readFile(join(store, "illustrations", "walk-accept.svg"), "utf8")).toBe(second);
    expect(await readdir(join(store, "illustrations"))).not.toContain("walk-accept.first.svg");

    const pictureOnly = await md("walk-picture-only");
    expect(pictureOnly).not.toContain("pictogram:");
    expect(pictureOnly).toContain("![Illustration of Walk picture only](../illustrations/walk-picture-only.svg)");

    const declined = await md("walk-decline");
    expect(declined).not.toContain("pictogram:");
    expect(declined).not.toContain("![");
    expect(await readdir(join(store, "illustrations"))).not.toContain("walk-decline.svg");
  });

  it("keeps the saved file readable as text and its image link resolves to the SVG", async () => {
    const file = join(store, "concepts", "walk-accept.md");
    const text = await readFile(file, "utf8");
    expect(text.startsWith("---\n")).toBe(true);
    expect(text).toMatch(/^## Illustration\n\nA sealed envelope\.\n\n!\[Illustration of Walk accept\]\(\.\.\/illustrations\/walk-accept\.svg\)\n$/m);
    const target = /!\[[^\]]*\]\(([^)]*)\)/.exec(text)![1]!;
    expect(await readFile(resolve(dirname(file), target), "utf8")).toBe(svg("second proposal"));
  });
});
