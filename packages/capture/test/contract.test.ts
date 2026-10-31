import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { configFilePath, loadConcepts, setupStore } from "@arch-mind/rules";

const serverFile = fileURLToPath(new URL("../dist/server.mjs", import.meta.url));
const docs = new URL("../../../docs/design/", import.meta.url);
const readJson = async (rel: string) => JSON.parse(await readFile(new URL(rel, docs), "utf8"));

const ajv = addFormats(new Ajv2020({ allErrors: true, strict: false }));
ajv.addSchema(await readJson("data/concept.schema.json"));
ajv.addSchema(await readJson("api/capture-tools.schema.json"));
const ROOT = "arch-mind/capture-tools.schema.json";
const schemaAt = (pointer: string) => {
  const validate = ajv.getSchema(`${ROOT}#${pointer}`);
  if (!validate) throw new Error(`schema not found: ${pointer}`);
  return validate;
};

let home: string;
let store: string;
let client: Client;

const complete = (over: Record<string, unknown> = {}) => ({
  id: "https",
  title: "HTTPS",
  layer: "network",
  domains: ["web"],
  concerns: ["security"],
  seeI: { statement: "s", elaboration: "e", example: "x", illustration: "i" },
  relations: [],
  recall: [{ question: "What is it?" }, { question: "Why?" }],
  ...over,
});

async function connect(env: Record<string, string>) {
  const transport = new StdioClientTransport({ command: process.execPath, args: [serverFile], env, stderr: "pipe" });
  const c = new Client({ name: "contract-test", version: "0.0.0" });
  await c.connect(transport);
  return c;
}

beforeAll(async () => {
  home = await mkdtemp(join(tmpdir(), "arch-mind-capture-"));
  store = join(home, "store");
  await setupStore(store, configFilePath(home));
  // No arch-mind local server is started anywhere in this file (AC-4).
  client = await connect({ USERPROFILE: home, HOME: home, PATH: process.env.PATH ?? "" });
});

afterAll(async () => {
  await client.close();
  await rm(home, { recursive: true, force: true });
});

describe("capture server contract (TST-003, AC-3, AC-4)", () => {
  it("publishes the four capture tools with schemas that accept contract-valid arguments", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["extend_concept", "get_concept", "list_concepts", "save_concept"]);
    const save = tools.find((t) => t.name === "save_concept")!;
    const published = ajv.compile(save.inputSchema as object);
    expect(published(complete())).toBe(true);
    expect(published(complete({ extra: 1 }))).toBe(false);
    expect(schemaAt("/$defs/tools/save_concept/inputSchema")(complete())).toBe(true);
    expect(ajv.compile(tools.find((t) => t.name === "list_concepts")!.inputSchema as object)({})).toBe(true);
  });

  it("list_concepts on an empty store returns the facet catalog and no concepts", async () => {
    const res = await client.callTool({ name: "list_concepts", arguments: {} });
    expect(res.isError).toBeFalsy();
    const validate = schemaAt("/$defs/tools/list_concepts/outputSchema");
    expect(validate(res.structuredContent), JSON.stringify(validate.errors)).toBe(true);
    expect(res.structuredContent).toEqual({
      concepts: [],
      facets: { domains: ["web", "mobile", "models"], concerns: ["security", "performance", "reliability"] },
    });
  });

  it("save_concept writes the file with recall ids q1..qn and the local date, matching the result schema", async () => {
    const res = await client.callTool({ name: "save_concept", arguments: complete() });
    expect(res.isError).toBeFalsy();
    const validate = schemaAt("/$defs/tools/save_concept/outputSchema");
    expect(validate(res.structuredContent), JSON.stringify(validate.errors)).toBe(true);
    const out = res.structuredContent as { id: string; file: string; recall: { id: string; confirmed: string }[] };
    expect(out.recall.map((q) => q.id)).toEqual(["q1", "q2"]);
    expect(out.recall[0]?.confirmed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(await readdir(join(store, "concepts"))).toEqual(["https.md"]);
    const stored = await loadConcepts(store);
    expect(stored.problems).toEqual([]);
    expect(stored.concepts[0]?.recall.map((q) => q.id)).toEqual(["q1", "q2"]);
  });

  it("list_concepts then returns the saved concept", async () => {
    const res = await client.callTool({ name: "list_concepts", arguments: {} });
    const validate = schemaAt("/$defs/tools/list_concepts/outputSchema");
    expect(validate(res.structuredContent)).toBe(true);
    expect(res.structuredContent).toMatchObject({
      concepts: [{ id: "https", title: "HTTPS", layer: "network", domains: ["web"], concerns: ["security"] }],
    });
  });

  it("returns an isError rejection matching the contract, naming every failed rule, and writes nothing", async () => {
    const before = await readdir(join(store, "concepts"));
    const res = await client.callTool({
      name: "save_concept",
      arguments: complete({
        id: "tls",
        relations: [
          { type: "requires", to: "ghost", explanation: "why" },
          { type: "requires", to: "https", source: "RFC", explanation: "why" },
        ],
        recall: [],
        domains: ["astrology"],
      }),
    });
    expect(res.isError).toBe(true);
    const validate = schemaAt("/$defs/rejection");
    expect(validate(res.structuredContent), JSON.stringify(validate.errors)).toBe(true);
    const pairs = (res.structuredContent as { errors: { path: string; rule: string }[] }).errors.map((e) => `${e.rule}@${e.path}`);
    expect(pairs.sort()).toEqual(
      ["missing_source@/relations/0/source", "missing_target@/relations/0/to", "no_recall@/recall", "unknown_facet@/domains/0"].sort(),
    );
    expect(await readdir(join(store, "concepts"))).toEqual(before);
  });

  it("rejects an existing id with duplicate_id and a malformed call with invalid_shape instead of a protocol error", async () => {
    const dup = await client.callTool({ name: "save_concept", arguments: complete() });
    expect(dup.isError).toBe(true);
    expect(schemaAt("/$defs/rejection")(dup.structuredContent)).toBe(true);
    expect(dup.structuredContent).toMatchObject({ errors: [{ path: "/id", rule: "duplicate_id" }] });

    const bad = await client.callTool({ name: "save_concept", arguments: { id: 7 } });
    expect(bad.isError).toBe(true);
    expect(schemaAt("/$defs/rejection")(bad.structuredContent)).toBe(true);
  });
});

describe("get_concept and extend_concept (TST-009, AC-1, AC-2, AC-3, AC-6)", () => {
  const call = (name: string, args: unknown) => client.callTool({ name, arguments: args as Record<string, unknown> });
  const fileText = (id: string) => readFile(join(store, "concepts", `${id}.md`), "utf8");

  it("publishes get_concept and extend_concept without an outputSchema, accepting contract-valid arguments", async () => {
    const { tools } = await client.listTools();
    expect(tools.every((t) => t.outputSchema === undefined)).toBe(true);
    const get = ajv.compile(tools.find((t) => t.name === "get_concept")!.inputSchema as object);
    expect(get({ id: "https" })).toBe(true);
    expect(get({})).toBe(false);
    const extend = ajv.compile(tools.find((t) => t.name === "extend_concept")!.inputSchema as object);
    const contract = schemaAt("/$defs/tools/extend_concept/inputSchema");
    const args = {
      id: "https",
      relations: [{ type: "uses", to: "tls", source: "RFC 8446", explanation: "why" }],
      episodes: [{ project: "p", situation: "s", date: "2026-10-31" }],
      recall: [{ question: "q?" }],
    };
    expect(extend(args)).toBe(true);
    expect(contract(args)).toBe(true);
    expect(extend({ id: "https", title: "x" })).toBe(false);
  });

  it("get_concept returns the stored concept matching concept.schema.json, and unknown_concept for a missing id", async () => {
    const res = await call("get_concept", { id: "https" });
    expect(res.isError).toBeFalsy();
    const validate = ajv.getSchema("arch-mind/concept.schema.json")!;
    expect(validate(res.structuredContent), JSON.stringify(validate.errors)).toBe(true);
    const stored = (await loadConcepts(store)).concepts.find((c) => c.id === "https");
    expect(res.structuredContent).toEqual(JSON.parse(JSON.stringify(stored)));

    const missing = await call("get_concept", { id: "ghost" });
    expect(missing.isError).toBe(true);
    expect(schemaAt("/$defs/rejection")(missing.structuredContent)).toBe(true);
    expect(missing.structuredContent).toMatchObject({ errors: [{ path: "/id", rule: "unknown_concept" }] });
  });

  it("extend_concept adds a relation, an episode and a recall question and reports only the added question", async () => {
    await call("save_concept", complete({ id: "tls", title: "TLS", recall: [{ question: "t?" }] }));
    const res = await call("extend_concept", {
      id: "https",
      relations: [{ type: "uses", to: "tls", source: "RFC 8446", explanation: "HTTPS runs over TLS" }],
      episodes: [{ project: "web", situation: "saw the handshake" }],
      recall: [{ question: "What does TLS add?" }],
    });
    expect(res.isError).toBeFalsy();
    const validate = schemaAt("/$defs/tools/extend_concept/outputSchema");
    expect(validate(res.structuredContent), JSON.stringify(validate.errors)).toBe(true);
    const out = res.structuredContent as { recall: { id: string }[] };
    expect(out.recall.map((q) => q.id)).toEqual(["q3"]);
    const stored = (await loadConcepts(store)).concepts.find((c) => c.id === "https")!;
    expect(stored.title).toBe("HTTPS");
    expect(stored.relations).toHaveLength(1);
    expect(stored.episodes).toHaveLength(1);
    expect(stored.recall.map((q) => q.id)).toEqual(["q1", "q2", "q3"]);
  });

  it.each([
    ["unknown_concept", "/id", { id: "ghost", recall: [{ question: "x" }] }],
    ["duplicate_relation", "/relations/0", { id: "https", relations: [{ type: "uses", to: "tls", source: "s", explanation: "e" }] }],
    ["missing_source", "/relations/0/source", { id: "https", relations: [{ type: "a", to: "tls", explanation: "e" }] }],
    ["missing_target", "/relations/0/to", { id: "https", relations: [{ type: "a", to: "ghost", source: "s", explanation: "e" }] }],
    ["nothing_to_add", "", { id: "https" }],
    ["invalid_shape", "/title", { id: "https", title: "New", recall: [{ question: "x" }] }],
  ])("extend_concept rejects %s at %j with a contract-valid rejection and writes nothing", async (rule, path, args) => {
    const before = await fileText("https");
    const res = await call("extend_concept", args);
    expect(res.isError).toBe(true);
    const validate = schemaAt("/$defs/rejection");
    expect(validate(res.structuredContent), JSON.stringify(validate.errors)).toBe(true);
    expect((res.structuredContent as { errors: { path: string; rule: string }[] }).errors).toContainEqual(
      expect.objectContaining({ rule, path }),
    );
    expect(await fileText("https")).toBe(before);
  });
});

describe("guided capture transcript (TST-011, AC-5)", () => {
  const proposals = {
    relations: [
      { type: "requires", to: "https", source: "RFC 9110 section 4.2.2", explanation: "" },
      { type: "uses", to: "tls", source: "RFC 8446", explanation: "" },
    ],
    seeI: {
      statement: "Claude draft statement.",
      elaboration: "Claude draft elaboration.",
      example: "Claude draft example.",
      illustration: "Claude draft illustration.",
    },
    recall: ["Claude question A?", "Claude question B?", "Claude question C?"],
  };
  const author = {
    acceptedRelation: { ...proposals.relations[0]!, explanation: "I wrote this sentence myself." },
    rewrittenIllustration: "A sealed envelope the author described.",
    acceptedQuestions: [proposals.recall[0]!, proposals.recall[2]!],
  };

  it("saves only the relation the author kept, the SEE-I part the author rewrote and the confirmed questions", async () => {
    const res = await client.callTool({
      name: "save_concept",
      arguments: {
        id: "hsts",
        title: "HSTS",
        layer: "network",
        domains: ["web"],
        concerns: ["security"],
        seeI: { ...proposals.seeI, illustration: author.rewrittenIllustration },
        relations: [author.acceptedRelation],
        recall: author.acceptedQuestions.map((question) => ({ question })),
      },
    });
    expect(res.isError).toBeFalsy();
    const text = await readFile(join(store, "concepts", "hsts.md"), "utf8");
    expect(text).toContain("I wrote this sentence myself.");
    expect(text).toContain(author.rewrittenIllustration);
    expect(text).not.toContain("Claude draft illustration.");
    expect(text).not.toContain("RFC 8446");
    expect(text).not.toContain("Claude question B?");
    const stored = (await loadConcepts(store)).concepts.find((c) => c.id === "hsts")!;
    expect(stored.relations).toEqual([author.acceptedRelation]);
    expect(stored.recall.map((q) => q.question)).toEqual(["Claude question A?", "Claude question C?"]);
  });
});

describe("capture server startup (R-5, AC-5)", () => {
  it("exits naming the config path when the config is missing", async () => {
    const empty = await mkdtemp(join(tmpdir(), "arch-mind-noconfig-"));
    try {
      const run = spawnSync(process.execPath, [serverFile], { env: { USERPROFILE: empty, HOME: empty, PATH: process.env.PATH ?? "" }, encoding: "utf8", timeout: 15000 });
      expect(run.status).toBe(1);
      expect(run.stderr).toContain(configFilePath(empty));
    } finally {
      await rm(empty, { recursive: true, force: true });
    }
  });
});
