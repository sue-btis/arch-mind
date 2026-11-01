import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { tst032Concepts, tst032RelationCount } from "../fixtures/tst-032.ts";
import {
  ID_PATTERN,
  LAYERS,
  LAYER_PICTOGRAM_IDS,
  PICTOGRAMS,
  StoreError,
  extendConcept,
  isPictogramId,
  loadConcept,
  loadConcepts,
  loadConfig,
  loadFacets,
  parseConcept,
  replaceConceptAtomic,
  saveConcept,
  serializeConcept,
  setupStore,
  writeConceptAtomic,
  type Concept,
} from "../src/index.ts";

const conceptSchema = JSON.parse(
  await readFile(new URL("../../../docs/design/data/concept.schema.json", import.meta.url), "utf8"),
);
const facetsSchema = JSON.parse(
  await readFile(new URL("../../../docs/design/data/facets.schema.json", import.meta.url), "utf8"),
);
const ajv = addFormats(new Ajv2020({ allErrors: true, strict: false }));
const validConcept = ajv.compile(conceptSchema);

const full: Concept = {
  id: "cookie-prefix",
  title: "Cookie: prefix",
  layer: "client",
  domains: ["web"],
  concerns: ["security"],
  seeI: {
    statement: "Line one.\n\nLine two with a `code` span and a # hash.",
    elaboration: "Elaboration.",
    example: "Set-Cookie: a=b; Secure",
    illustration: "A name tag.",
  },
  relations: [
    { type: "requires", to: "other", source: "RFC 1: §2", explanation: "Because: reasons." },
    { type: "uses", to: "third", source: "https://example.com/x", explanation: "Also." },
  ],
  episodes: [
    { project: "alpha", situation: "Saw it fail.", date: "2026-10-01" },
    { project: "beta", situation: "Saw it again." },
  ],
  recall: [
    { id: "q1", question: "What?", confirmed: "2026-10-30" },
    { id: "q2", question: "Why: because?", confirmed: "2026-10-30" },
  ],
};

describe("concept file round trip (TST-001, AC-1)", () => {
  it("parses what it serializes for a concept with every field", () => {
    expect(parseConcept(serializeConcept(full))).toEqual(full);
  });

  it("omits an empty episodes list and reads it back as []", () => {
    const text = serializeConcept({ ...full, episodes: [] });
    expect(text).not.toContain("episodes");
    expect(parseConcept(text).episodes).toEqual([]);
  });

  it("keeps the frontmatter in schema key order and the SEE-I under the four headings", () => {
    const text = serializeConcept(full);
    const keys = [...text.split("\n---\n")[0]!.matchAll(/^([a-z]+):/gm)].map((m) => m[1]);
    expect(keys).toEqual(["id", "title", "layer", "domains", "concerns", "relations", "episodes", "recall"]);
    const headings = text.split("\n").filter((l) => l.startsWith("## "));
    expect(headings).toEqual(["## Statement", "## Elaboration", "## Example", "## Illustration"]);
  });

  it("round-trips the 13 TST-032 concepts and each satisfies concept.schema.json", () => {
    expect(tst032Concepts).toHaveLength(13);
    expect(tst032RelationCount).toBe(15);
    for (const c of tst032Concepts) {
      const back = parseConcept(serializeConcept(c));
      expect(back).toEqual(c);
      expect(validConcept(back), JSON.stringify(validConcept.errors)).toBe(true);
    }
  });

  it("reads as plain text with SEE-I, relation sources and recall questions (AC-11)", () => {
    const text = serializeConcept(full);
    expect(text).toContain("## Statement\n\nLine one.");
    expect(text).toContain("source: \"RFC 1: §2\"");
    expect(text).toContain("question: What?");
  });

  it("reports a file whose frontmatter is broken", () => {
    expect(() => parseConcept("no frontmatter")).toThrow(/frontmatter/);
    expect(() => parseConcept("---\nid: [\n---\n")).toThrow(/YAML/);
  });
});

describe("store", () => {
  let dir: string;
  let store: string;
  let configFile: string;
  const valid = (over: Record<string, unknown> = {}) => ({
    id: "alpha",
    title: "Alpha",
    layer: "server",
    domains: ["web"],
    concerns: ["security"],
    seeI: { statement: " s ", elaboration: "e", example: "x", illustration: "i" },
    relations: [],
    recall: [{ question: "q one" }, { question: "q two" }],
    ...over,
  });

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "arch-mind-rules-"));
    store = join(dir, "store");
    configFile = join(dir, "home", ".arch-mind", "config.json");
    await setupStore(store, configFile);
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  const files = () => readdir(join(store, "concepts"));

  describe("setup (R-5, R-6)", () => {
    it("writes config, concepts/, seed facets.yaml and an empty reviews.jsonl", async () => {
      expect(await loadConfig(configFile)).toEqual({ storePath: store });
      expect(await files()).toEqual([]);
      expect(await readFile(join(store, "reviews.jsonl"), "utf8")).toBe("");
      const facets = await loadFacets(store);
      expect(facets).toEqual({
        domains: ["web", "mobile", "models"],
        concerns: ["security", "performance", "reliability"],
        leitnerIntervalsDays: [1, 3, 7, 16, 35],
      });
      expect(ajv.compile(facetsSchema)(facets)).toBe(true);
      expect(await readFile(join(store, "facets.yaml"), "utf8")).toMatch(/# .*PD-016/);
    });

    it("refuses to overwrite facets.yaml or reviews.jsonl", async () => {
      await expect(setupStore(store, configFile)).rejects.toThrow(/already exists/);
      await rm(join(store, "facets.yaml"));
      await expect(setupStore(store, configFile)).rejects.toThrow(/reviews\.jsonl already exists/);
    });

    it("names the config path when the config is missing or invalid", async () => {
      await rm(configFile);
      await expect(loadConfig(configFile)).rejects.toThrow(configFile);
      await writeFile(configFile, '{"storePath": "relative"}');
      await expect(loadConfig(configFile)).rejects.toThrow(configFile);
      await writeFile(configFile, "not json");
      await expect(loadConfig(configFile)).rejects.toBeInstanceOf(StoreError);
    });

    it("names facets.yaml when it is missing", async () => {
      await rm(join(store, "facets.yaml"));
      await expect(loadFacets(store)).rejects.toThrow(join(store, "facets.yaml"));
    });
  });

  describe("save_concept rules (TST-002, AC-2, AC-3, AC-6)", () => {
    it("saves a valid concept, assigns recall ids in order and the local date, trims SEE-I", async () => {
      const out = await saveConcept(store, valid(), { today: "2026-10-30" });
      expect(out).toMatchObject({
        ok: true,
        id: "alpha",
        recall: [
          { id: "q1", confirmed: "2026-10-30" },
          { id: "q2", confirmed: "2026-10-30" },
        ],
      });
      const { concepts, problems } = await loadConcepts(store);
      expect(problems).toEqual([]);
      expect(concepts[0]?.seeI.statement).toBe("s");
      expect(concepts[0]?.recall.map((q) => q.id)).toEqual(["q1", "q2"]);
    });

    it("rejects with the frozen path and rule for each rule, writing nothing", async () => {
      await saveConcept(store, valid({ id: "existing" }));
      const before = await files();
      const rel = (over: object) => ({ type: "uses", to: "existing", source: "src", explanation: "why", ...over });
      const cases: [string, Record<string, unknown>, string, string][] = [
        ["missing source", { relations: [rel({ source: "" })] }, "/relations/0/source", "missing_source"],
        ["source absent", { relations: [{ type: "uses", to: "existing", explanation: "why" }] }, "/relations/0/source", "missing_source"],
        ["missing target", { relations: [rel({ to: "nobody" })] }, "/relations/0/to", "missing_target"],
        ["self target", { relations: [rel({ to: "alpha" })] }, "/relations/0/to", "missing_target"],
        ["duplicate id", { id: "existing" }, "/id", "duplicate_id"],
        ["empty SEE-I part", { seeI: { statement: "s", elaboration: " ", example: "x", illustration: "i" } }, "/seeI/elaboration", "incomplete_see_i"],
        ["absent SEE-I part", { seeI: { statement: "s", elaboration: "e", example: "x" } }, "/seeI/illustration", "incomplete_see_i"],
        ["no recall", { recall: [] }, "/recall", "no_recall"],
        ["layer outside the list", { layer: "edge" }, "/layer", "invalid_shape"],
        ["unknown domain", { domains: ["web", "astrology"] }, "/domains/1", "unknown_facet"],
        ["unknown concern", { concerns: ["vibes"] }, "/concerns/0", "unknown_facet"],
        ["repeated relation", { relations: [rel({}), rel({})] }, "/relations/1", "duplicate_relation"],
        ["unknown field", { extra: 1 }, "/extra", "invalid_shape"],
        ["impossible episode date", { episodes: [{ project: "p", situation: "s", date: "2026-02-30" }] }, "/episodes/0/date", "invalid_shape"],
      ];
      for (const [name, over, path, rule] of cases) {
        const out = await saveConcept(store, valid(over));
        expect(out.ok, name).toBe(false);
        if (!out.ok) expect(out.errors, name).toContainEqual(expect.objectContaining({ path, rule }));
      }
      expect(await files()).toEqual(before);
    });

    it("collects every failed rule in one result", async () => {
      const out = await saveConcept(
        store,
        valid({ relations: [{ type: "uses", to: "nobody", explanation: "why" }], recall: [], domains: ["x"] }),
      );
      expect(out.ok).toBe(false);
      if (!out.ok) {
        expect(out.errors.map((e) => `${e.rule}@${e.path}`).sort()).toEqual(
          ["missing_source@/relations/0/source", "missing_target@/relations/0/to", "no_recall@/recall", "unknown_facet@/domains/0"].sort(),
        );
      }
    });

    it("accepts a relation to a stored concept", async () => {
      await saveConcept(store, valid({ id: "existing" }));
      const out = await saveConcept(store, valid({ relations: [{ type: "uses", to: "existing", source: "s", explanation: "e" }] }));
      expect(out.ok).toBe(true);
    });
  });

  describe("atomic write (TST-004, AC-10)", () => {
    it("leaves no file when interrupted between the temporary write and the rename, and the loader ignores the temp file", async () => {
      let sawTemp: string[] = [];
      const boom = new Error("killed");
      await expect(
        saveConcept(store, valid(), {
          beforeRename: async () => {
            sawTemp = await files();
            const loaded = await loadConcepts(store);
            expect(loaded).toEqual({ concepts: [], problems: [] });
            throw boom;
          },
        }),
      ).rejects.toBe(boom);
      expect(sawTemp).toHaveLength(1);
      expect(sawTemp[0]).toMatch(/^\..*\.tmp$/);
      expect(await files()).toEqual([]);
    });

    it("keeps the old file when a concurrent save creates the id just before the rename", async () => {
      const winner = serializeConcept({ ...full, id: "alpha" });
      const out = await saveConcept(store, valid(), {
        beforeRename: () => writeFile(join(store, "concepts", "alpha.md"), winner),
      });
      expect(out).toMatchObject({ ok: false, errors: [{ path: "/id", rule: "duplicate_id" }] });
      expect(await readFile(join(store, "concepts", "alpha.md"), "utf8")).toBe(winner);
      expect(await files()).toEqual(["alpha.md"]);
    });
  });

  it("lists a file whose dates do not exist on the calendar as a problem", async () => {
    const bad: Concept = { ...full, id: "bad-date", relations: [], recall: [{ id: "q1", question: "q", confirmed: "2026-02-30" }] };
    await writeFile(join(store, "concepts", "bad-date.md"), serializeConcept(bad), "utf8");
    const { concepts, problems } = await loadConcepts(store);
    expect(concepts.map((c) => c.id)).not.toContain("bad-date");
    expect(problems).toContainEqual(expect.objectContaining({ file: "bad-date.md" }));
  });

  it("lists a hand-broken file as a problem instead of loading it", async () => {
    await writeFile(join(store, "concepts", "broken.md"), "---\nid: broken\n---\n");
    await saveConcept(store, valid());
    const { concepts, problems } = await loadConcepts(store);
    expect(concepts.map((c) => c.id)).toEqual(["alpha"]);
    expect(problems).toEqual([{ file: "broken.md", reason: expect.any(String) }]);
  });

  it("blocks an id that belongs to a broken file", async () => {
    await writeFile(join(store, "concepts", "broken.md"), "garbage");
    const out = await saveConcept(store, valid({ id: "broken" }));
    expect(out).toMatchObject({ ok: false, errors: [{ rule: "duplicate_id" }] });
  });
});

describe("extend and replace (TST-010, AC-2, AC-3, AC-4)", () => {
  let dir: string;
  let store: string;
  const base = (over: Record<string, unknown> = {}) => ({
    id: "alpha",
    title: "Alpha",
    layer: "server",
    domains: ["web"],
    concerns: ["security"],
    seeI: { statement: "s", elaboration: "e", example: "x", illustration: "i" },
    relations: [{ type: "uses", to: "beta", source: "RFC 1", explanation: "because" }],
    episodes: [{ project: "p", situation: "saw it" }],
    recall: [{ question: "one" }, { question: "two" }, { question: "three" }],
    ...over,
  });
  const alphaFile = () => join(store, "concepts", "alpha.md");
  const concepts = () => readdir(join(store, "concepts"));

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "arch-mind-extend-"));
    store = join(dir, "store");
    await setupStore(store, join(dir, "home", ".arch-mind", "config.json"));
    await saveConcept(store, base({ id: "beta", relations: [], episodes: undefined, recall: [{ question: "b" }] }));
    await saveConcept(store, base({ id: "gamma", relations: [], episodes: undefined, recall: [{ question: "g" }] }));
    await saveConcept(store, base(), { today: "2026-01-02" });
    // Hand-deleting q2 leaves q1,q3 stored: the next id must follow the highest, not the count.
    const stored = await readFile(alphaFile(), "utf8");
    await writeFile(alphaFile(), stored.replace(/ {2}- id: q2\n.*\n.*\n/, ""));
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it("loadConcept returns the stored concept and reports unknown and unreadable ids as unknown_concept at /id", async () => {
    const out = await loadConcept(store, "alpha");
    expect(out).toMatchObject({ ok: true, concept: { id: "alpha", recall: [{ id: "q1" }, { id: "q3" }] } });
    expect(await loadConcept(store, "ghost")).toMatchObject({ ok: false, errors: [{ path: "/id", rule: "unknown_concept" }] });
    await writeFile(join(store, "concepts", "broken.md"), "garbage");
    expect(await loadConcept(store, "broken")).toMatchObject({
      ok: false,
      errors: [{ path: "/id", rule: "unknown_concept", message: expect.stringContaining("broken.md") }],
    });
  });

  it("adds relations, an episode and recall questions, keeps stored fields, and numbers recall after the highest q", async () => {
    const before = (await loadConcept(store, "alpha")) as { concept: Concept };
    const out = await extendConcept(
      store,
      {
        id: "alpha",
        relations: [{ type: "uses", to: "gamma", source: "RFC 2", explanation: "why" }],
        episodes: [{ project: "q", situation: "again", date: "2026-10-31" }],
        recall: [{ question: "four" }, { question: "five" }],
      },
      { today: "2026-10-31" },
    );
    expect(out).toEqual({
      ok: true,
      id: "alpha",
      file: alphaFile(),
      recall: [
        { id: "q4", confirmed: "2026-10-31" },
        { id: "q5", confirmed: "2026-10-31" },
      ],
    });
    const after = ((await loadConcept(store, "alpha")) as { concept: Concept }).concept;
    expect(after).toMatchObject({
      id: before.concept.id,
      title: before.concept.title,
      layer: before.concept.layer,
      domains: before.concept.domains,
      concerns: before.concept.concerns,
      seeI: before.concept.seeI,
    });
    expect(after.relations).toEqual([...before.concept.relations, { type: "uses", to: "gamma", source: "RFC 2", explanation: "why" }]);
    expect(after.episodes).toHaveLength(2);
    expect(after.recall.map((q) => q.id)).toEqual(["q1", "q3", "q4", "q5"]);
    expect(after.recall.slice(0, 2)).toEqual(before.concept.recall);
    expect(validConcept(after), JSON.stringify(validConcept.errors)).toBe(true);
    expect(await concepts()).toEqual(["alpha.md", "beta.md", "gamma.md"]);
  });

  const rejections: [string, Record<string, unknown>, string][] = [
    ["unknown_concept@/id", { id: "ghost", recall: [{ question: "x" }] }, "ghost"],
    ["duplicate_relation@/relations/0", { id: "alpha", relations: [{ type: "uses", to: "beta", source: "s", explanation: "e" }] }, "alpha"],
    [
      "duplicate_relation@/relations/1",
      {
        id: "alpha",
        relations: [
          { type: "uses", to: "gamma", source: "s", explanation: "e" },
          { type: "uses", to: "gamma", source: "s", explanation: "e" },
        ],
      },
      "alpha",
    ],
    ["missing_source@/relations/0/source", { id: "alpha", relations: [{ type: "a", to: "gamma", explanation: "e" }] }, "alpha"],
    ["missing_target@/relations/0/to", { id: "alpha", relations: [{ type: "a", to: "ghost", source: "s", explanation: "e" }] }, "alpha"],
    ["missing_target@/relations/0/to", { id: "alpha", relations: [{ type: "a", to: "alpha", source: "s", explanation: "e" }] }, "alpha"],
    ["nothing_to_add@", { id: "alpha" }, "alpha"],
    ["nothing_to_add@", { id: "alpha", relations: [], episodes: [], recall: [] }, "alpha"],
    ["invalid_shape@/title", { id: "alpha", title: "New", recall: [{ question: "x" }] }, "alpha"],
    ["invalid_shape@/recall/0/question", { id: "alpha", recall: [{ question: " " }] }, "alpha"],
  ];
  it.each(rejections)("rejects with %s and leaves the file byte-identical", async (pair, input, id) => {
    const target = join(store, "concepts", `${id}.md`);
    const before = await readFile(target, "utf8").catch(() => null);
    const out = await extendConcept(store, input);
    expect(out.ok).toBe(false);
    const pairs = out.ok ? [] : out.errors.map((e) => `${e.rule}@${e.path}`);
    expect(pairs).toContain(pair);
    expect(await readFile(target, "utf8").catch(() => null)).toBe(before);
    expect(await concepts()).toEqual(["alpha.md", "beta.md", "gamma.md"]);
  });

  it("collects every failed rule in one rejection", async () => {
    const out = await extendConcept(store, {
      id: "alpha",
      relations: [{ type: "uses", to: "beta", source: "s", explanation: "e" }, { type: "x", to: "ghost", explanation: "e" }],
    });
    expect(out.ok ? [] : out.errors.map((e) => `${e.rule}@${e.path}`).sort()).toEqual([
      "duplicate_relation@/relations/0",
      "missing_source@/relations/1/source",
      "missing_target@/relations/1/to",
    ]);
  });

  it("keeps the old file and no visible temp file when interrupted between the temporary write and the rename", async () => {
    const before = await readFile(alphaFile(), "utf8");
    const boom = new Error("killed");
    let during: string[] = [];
    await expect(
      extendConcept(
        store,
        { id: "alpha", recall: [{ question: "four" }] },
        {
          beforeRename: async () => {
            during = await concepts();
            const loaded = await loadConcepts(store);
            expect(loaded.problems).toEqual([]);
            expect(loaded.concepts.find((c) => c.id === "alpha")?.recall).toHaveLength(2);
            throw boom;
          },
        },
      ),
    ).rejects.toBe(boom);
    expect(during.filter((n) => n.endsWith(".tmp"))).toHaveLength(1);
    expect(await readFile(alphaFile(), "utf8")).toBe(before);
    expect(await concepts()).toEqual(["alpha.md", "beta.md", "gamma.md"]);
  });

  it("replaceConceptAtomic replaces an existing file and leaves only the new one (ASM-1)", async () => {
    const current = ((await loadConcept(store, "alpha")) as { concept: Concept }).concept;
    await replaceConceptAtomic(store, { ...current, title: "Replaced" });
    expect(((await loadConcept(store, "alpha")) as { concept: Concept }).concept.title).toBe("Replaced");
    expect(await concepts()).toEqual(["alpha.md", "beta.md", "gamma.md"]);
  });
});

describe("pictogram (TST-021, AC-025, AC-029-r)", () => {
  let dir: string;
  let store: string;
  const withPictogram = (id: string, pictogram: string): Concept => ({ ...full, id, pictogram });

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "arch-mind-pictogram-"));
    store = join(dir, "store");
    await setupStore(store, join(dir, "home", ".arch-mind", "config.json"));
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it("catalogs the four layer ids first and gives every entry a unique id and a one-line meaning", () => {
    expect(PICTOGRAMS.slice(0, 4).map((p) => p.id)).toEqual([...LAYERS]);
    expect(LAYER_PICTOGRAM_IDS).toEqual(LAYERS);
    expect(new Set(PICTOGRAMS.map((p) => p.id)).size).toBe(PICTOGRAMS.length);
    for (const p of PICTOGRAMS) {
      expect(p.id).toMatch(ID_PATTERN);
      expect(p.meaning).toMatch(/^[^\n]+$/);
    }
    expect(tst032Concepts.every((c) => c.pictogram !== undefined && isPictogramId(c.pictogram))).toBe(true);
  });

  it("round-trips a pictogram and writes its key right after layer", () => {
    const concept = withPictogram("cookie-prefix", "cookie-house");
    const text = serializeConcept(concept);
    expect(parseConcept(text)).toEqual(concept);
    const keys = [...text.split("\n---\n")[0]!.matchAll(/^([a-z]+):/gm)].map((m) => m[1]);
    expect(keys.slice(0, 4)).toEqual(["id", "title", "layer", "pictogram"]);
    expect(validConcept(parseConcept(text))).toBe(true);
  });

  it("writes no pictogram key for a concept without one", () => {
    expect(serializeConcept(full)).not.toContain("pictogram");
    expect(parseConcept(serializeConcept(full)).pictogram).toBeUndefined();
  });

  it("rejects a pictogram that is not a kebab-case id", () => {
    const text = serializeConcept(full).replace("layer: client\n", "layer: client\npictogram: Not An Id\n");
    expect(() => parseConcept(text)).toThrow(/\/pictogram/);
  });

  it("keeps the pictogram when a concept is extended", async () => {
    await writeConceptAtomic(store, { ...withPictogram("alpha", "lock-upgrade"), relations: [] });
    const out = await extendConcept(store, { id: "alpha", episodes: [{ project: "p", situation: "again" }] });
    expect(out.ok).toBe(true);
    expect(((await loadConcept(store, "alpha")) as { concept: Concept }).concept.pictogram).toBe("lock-upgrade");
  });

  it("loads a concept with an unknown pictogram id and lists the file in problems, also on a cache hit", async () => {
    await writeConceptAtomic(store, { ...withPictogram("alpha", "cookie-house"), relations: [] });
    await writeConceptAtomic(store, { ...withPictogram("beta", "no-such-picture"), relations: [] });
    for (let load = 0; load < 2; load++) {
      const { concepts, problems } = await loadConcepts(store);
      expect(concepts.map((c) => c.id)).toEqual(["alpha", "beta"]);
      expect(problems).toEqual([{ file: "beta.md", reason: expect.stringContaining('"no-such-picture"') }]);
    }
  });

  it("serves hasIllustration as false in the list, not in the stored concept, and never writes it to the file", async () => {
    await writeConceptAtomic(store, { ...withPictogram("alpha", "shield"), relations: [] });
    const { concepts } = await loadConcepts(store);
    expect(concepts[0]!.hasIllustration).toBe(false);
    expect(((await loadConcept(store, "alpha")) as { concept: Concept }).concept.hasIllustration).toBeUndefined();
    expect(await readFile(join(store, "concepts", "alpha.md"), "utf8")).not.toContain("hasIllustration");
    await extendConcept(store, { id: "alpha", episodes: [{ project: "p", situation: "again" }] });
    expect(await readFile(join(store, "concepts", "alpha.md"), "utf8")).not.toContain("hasIllustration");
  });
});
