import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { parse as parseYaml } from "yaml";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { tst032Concepts } from "../fixtures/tst-032.ts";
import {
  StoreError,
  addDays,
  appendReviewLine,
  loadDueQuestions,
  localDate,
  parseReviewRequest,
  recordReview,
  selectDue,
  loadConceptDetail,
  loadReviewLines,
  replayQuestionStates,
  setupStore,
  writeConceptAtomic,
  type Concept,
  type ReviewLine,
} from "../src/index.ts";

const INTERVALS = [1, 3, 7, 16, 35];
const concept: Concept = { ...tst032Concepts[0]!, id: "cookie", recall: [{ id: "q1", question: "Why?", confirmed: "2026-10-30" }] };
const at = (month: number, day: number) => new Date(2026, month - 1, day, 12).toISOString();
const line = (day: number, result: ReviewLine["result"], question = "cookie#q1"): ReviewLine => ({ question, at: at(11, day), result });

describe("review state replay (AC-7, BR-006)", () => {
  it("starts in box 1, due the day after confirmation", () => {
    expect(replayQuestionStates(concept, [], INTERVALS)).toEqual([
      { question: "cookie#q1", conceptId: "cookie", text: "Why?", box: 1, due: "2026-10-31" },
    ]);
  });

  it("moves up one box per right answer and counts the interval from the review date", () => {
    const [state] = replayQuestionStates(concept, [line(1, "right"), line(4, "right")], INTERVALS);
    expect(state).toMatchObject({ box: 3, due: addDays("2026-11-04", 7) });
  });

  it("returns to box 1 after a wrong answer", () => {
    const [state] = replayQuestionStates(concept, [line(1, "right"), line(4, "wrong")], INTERVALS);
    expect(state).toMatchObject({ box: 1, due: "2026-11-05" });
  });

  it("stays in the last box after more right answers than boxes", () => {
    const lines = Array.from({ length: 8 }, (_, i) => line(i + 1, "right"));
    expect(replayQuestionStates(concept, lines, INTERVALS)[0]).toMatchObject({ box: 5, due: addDays("2026-11-08", 35) });
  });

  it("ignores lines for other questions", () => {
    const [state] = replayQuestionStates(concept, [line(1, "right", "other#q1"), line(2, "right", "cookie#q9")], INTERVALS);
    expect(state).toMatchObject({ box: 1, due: "2026-10-31" });
  });
});

describe("reviews.jsonl loader and concept detail", () => {
  let dir: string;
  let store: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "arch-mind-reviews-"));
    store = await setupStore(join(dir, "store"), join(dir, "config.json"));
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  const good = JSON.stringify({ question: "cookie#q1", at: "2026-11-01T10:00:00Z", result: "right" });

  it("treats a missing or empty file as no reviews", async () => {
    expect(await loadReviewLines(store)).toEqual([]);
    await rm(join(store, "reviews.jsonl"));
    expect(await loadReviewLines(store)).toEqual([]);
  });

  it("reads valid lines in file order", async () => {
    await writeFile(join(store, "reviews.jsonl"), `${good}\n\n${good.replace("right", "wrong")}\n`);
    expect((await loadReviewLines(store)).map((l) => l.result)).toEqual(["right", "wrong"]);
  });

  it.each([
    ["not JSON", "{oops"],
    ["a missing field", JSON.stringify({ question: "cookie#q1", result: "right" })],
    ["an extra field", good.replace("}", ',"x":1}')],
    ["a bad question id", good.replace("cookie#q1", "Cookie")],
    ["a bad date-time", good.replace("2026-11-01T10:00:00Z", "yesterday")],
    ["a day that does not exist", good.replace("2026-11-01T10:00:00Z", "2026-02-30T10:00:00Z")],
    ["hour 24", good.replace("2026-11-01T10:00:00Z", "2026-01-01T24:00:00Z")],
    ["a bad result", good.replace("right", "maybe")],
  ])("throws a StoreError naming the line for %s", async (_name, bad) => {
    await writeFile(join(store, "reviews.jsonl"), `${good}\n${bad}\n`);
    await expect(loadReviewLines(store)).rejects.toThrow(StoreError);
    await expect(loadReviewLines(store)).rejects.toThrow(/line 2/);
  });

  it("TST-015: the detail validates against the openapi 200 schema and the concept schema", async () => {
    const docs = new URL("../../../docs/design/", import.meta.url);
    const openapi = parseYaml(await readFile(new URL("api/openapi.yaml", docs), "utf8"));
    const schema = openapi.paths["/api/concepts/{id}"].get.responses["200"].content["application/json"].schema;
    const ajv = addFormats(new Ajv2020({ allErrors: true, strict: false }));
    const validDetail = ajv.compile({ ...schema, components: openapi.components });
    const validConcept = ajv.compile(JSON.parse(await readFile(new URL("data/concept.schema.json", docs), "utf8")));

    await writeConceptAtomic(store, concept);
    await writeFile(join(store, "reviews.jsonl"), `${good}\n`);
    const detail = await loadConceptDetail(store, "cookie");
    expect(detail.ok).toBe(true);
    if (!detail.ok) return;
    const body = JSON.parse(JSON.stringify({ concept: detail.concept, questions: detail.questions }));
    expect(validDetail(body), JSON.stringify(validDetail.errors)).toBe(true);
    const { hasIllustration, ...stored } = body.concept;
    expect(hasIllustration).toBe(false);
    expect(validConcept(stored), JSON.stringify(validConcept.errors)).toBe(true);
    expect(body.questions[0]).toMatchObject({ question: "cookie#q1", box: 2 });
  });

  it("reports an unknown id, a bad pattern and an unreadable file as errors", async () => {
    await writeFile(join(store, "concepts", "broken.md"), "not a concept");
    for (const id of ["nope", "Bad_Id", "broken"]) {
      const outcome = await loadConceptDetail(store, id);
      expect(outcome.ok, id).toBe(false);
    }
  });

  it("lets a malformed review log fail the detail instead of showing a wrong state", async () => {
    await writeConceptAtomic(store, concept);
    await writeFile(join(store, "reviews.jsonl"), "garbage\n");
    await expect(loadConceptDetail(store, "cookie")).rejects.toThrow(/line 1/);
  });
});

describe("TST-016: scheduler replay with the intervals read from facets (BR-006)", () => {
  it("uses whatever intervals it is given, not the seed ones", () => {
    const intervals = [2, 5, 11];
    expect(replayQuestionStates(concept, [], intervals)[0]).toMatchObject({ box: 1, due: "2026-10-31" });
    expect(replayQuestionStates(concept, [line(1, "right")], intervals)[0]).toMatchObject({ box: 2, due: addDays("2026-11-01", 5) });
    const lines = [1, 2, 3, 4].map((d) => line(d, "right"));
    expect(replayQuestionStates(concept, lines, intervals)[0]).toMatchObject({ box: 3, due: addDays("2026-11-04", 11) });
    expect(replayQuestionStates(concept, [...lines, line(5, "wrong")], intervals)[0]).toMatchObject({ box: 1, due: addDays("2026-11-05", 2) });
  });

  it("works with a single box", () => {
    expect(replayQuestionStates(concept, [line(1, "right"), line(2, "right")], [4])[0]).toMatchObject({ box: 1, due: addDays("2026-11-02", 4) });
  });
});

describe("due list, review request and recording", () => {
  let dir: string;
  let store: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "arch-mind-due-"));
    store = await setupStore(join(dir, "store"), join(dir, "config.json"));
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  const state = (conceptId: string, q: string, due: string) => ({ question: `${conceptId}#${q}`, conceptId, text: "?", box: 1, due });

  it("lists questions due on or before today by due date, concept id, then question number", () => {
    const states = [
      state("b", "q1", "2026-11-02"),
      state("a", "q10", "2026-11-02"),
      state("a", "q2", "2026-11-02"),
      state("z", "q1", "2026-11-01"),
      state("a", "q1", "2026-11-03"),
      state("c", "q1", "2026-12-24"),
    ];
    expect(selectDue(states, "2026-11-03").map((s) => s.question)).toEqual(["z#q1", "a#q2", "a#q10", "b#q1", "a#q1"]);
    expect(selectDue(states, "2026-11-02").map((s) => s.question)).toEqual(["z#q1", "a#q2", "a#q10", "b#q1"]);
    expect(selectDue(states, "2026-10-31")).toEqual([]);
  });

  async function fixtureStore() {
    const today = localDate();
    await writeConceptAtomic(store, { ...concept, id: "dueconcept", recall: [{ id: "q1", question: "Due?", confirmed: addDays(today, -1) }] });
    await writeConceptAtomic(store, { ...concept, id: "later", recall: [{ id: "q1", question: "Later?", confirmed: today }] });
    return today;
  }

  async function snapshot(): Promise<string> {
    const names = [...(await readdir(store)), ...(await readdir(join(store, "concepts"))).map((n) => `concepts/${n}`)].sort();
    const entries = await Promise.all(names.map(async (n) => [n, (await readFile(join(store, n)).catch(() => null))?.toString()]));
    return JSON.stringify(entries);
  }

  it("loads only what is due today and leaves every file byte-identical (box and due are never stored)", async () => {
    const today = await fixtureStore();
    const before = await snapshot();
    const due = await loadDueQuestions(store);
    expect(due.map((s) => s.question)).toEqual(["dueconcept#q1"]);
    expect(due[0]).toMatchObject({ box: 1, due: today });
    expect(await snapshot()).toBe(before);
  });

  it("validates the due list, a recorded state and request bodies against the openapi schemas", async () => {
    await fixtureStore();
    const docs = new URL("../../../docs/design/", import.meta.url);
    const openapi = parseYaml(await readFile(new URL("api/openapi.yaml", docs), "utf8"));
    const ajv = addFormats(new Ajv2020({ allErrors: true, strict: false }));
    const validList = ajv.compile({ ...openapi.paths["/api/reviews/due"].get.responses["200"].content["application/json"].schema, components: openapi.components });
    const validState = ajv.compile({ ...openapi.paths["/api/reviews"].post.responses["201"].content["application/json"].schema, components: openapi.components });
    const validRequest = ajv.compile(openapi.paths["/api/reviews"].post.requestBody.content["application/json"].schema);

    expect(validList(await loadDueQuestions(store)), JSON.stringify(validList.errors)).toBe(true);
    const outcome = await recordReview(store, { question: "dueconcept#q1", result: "right" });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(validState(outcome.state), JSON.stringify(validState.errors)).toBe(true);
    const bodies = [
      { question: "a#q1", result: "right" },
      { question: "A#q1", result: "right" },
      { question: "a#q1", result: "maybe" },
      { question: "a#q1" },
      { question: "a#q1", result: "right", x: 1 },
    ];
    for (const body of bodies) expect(parseReviewRequest(body).ok, JSON.stringify(body)).toBe(validRequest(body));
    for (const body of [null, [], "text", 7]) expect(parseReviewRequest(body).ok).toBe(false);
  });

  it("TST-017: each review adds exactly one schema-valid line and leaves earlier bytes untouched", async () => {
    await fixtureStore();
    const schema = JSON.parse(await readFile(new URL("../../../docs/design/data/review-line.schema.json", import.meta.url), "utf8"));
    const validLine = addFormats(new Ajv2020({ allErrors: true, strict: false })).compile(schema);
    const file = join(store, "reviews.jsonl");
    const results = ["right", "right", "wrong", "right"] as const;
    for (const [i, result] of results.entries()) {
      const before = await readFile(file);
      expect((await recordReview(store, { question: "dueconcept#q1", result })).ok).toBe(true);
      const after = await readFile(file);
      expect(after.subarray(0, before.length).equals(before)).toBe(true);
      const added = after.subarray(before.length).toString();
      expect(added.indexOf("\n")).toBe(added.length - 1);
      expect(validLine(JSON.parse(added)), JSON.stringify(validLine.errors)).toBe(true);
      expect(after.toString().trim().split("\n")).toHaveLength(i + 1);
    }
  });

  it("appends after existing content without touching it", async () => {
    await writeFile(join(store, "reviews.jsonl"), '{"question":"x#q1","at":"2026-11-01T10:00:00Z","result":"right"}\n');
    await appendReviewLine(store, { question: "x#q2", at: "2026-11-02T10:00:00.000Z", result: "wrong" });
    expect((await loadReviewLines(store)).map((l) => l.question)).toEqual(["x#q1", "x#q2"]);
  });

  it("starts a new line when the log lacks a trailing newline, leaving earlier bytes untouched", async () => {
    const file = join(store, "reviews.jsonl");
    await writeFile(file, '{"question":"x#q1","at":"2026-11-01T10:00:00Z","result":"right"}');
    const before = await readFile(file);
    await appendReviewLine(store, { question: "x#q2", at: "2026-11-02T10:00:00.000Z", result: "wrong" });
    const after = await readFile(file);
    expect(after.subarray(0, before.length).equals(before)).toBe(true);
    expect(after.subarray(before.length).toString()).toBe('\n{"question":"x#q2","at":"2026-11-02T10:00:00.000Z","result":"wrong"}\n');
    expect((await loadReviewLines(store)).map((l) => l.question)).toEqual(["x#q1", "x#q2"]);
  });

  it("replays the new state: right moves up, wrong returns to box 1, counting from the review day", async () => {
    await fixtureStore();
    const right = await recordReview(store, { question: "dueconcept#q1", result: "right" }, new Date(2026, 10, 20, 12));
    expect(right).toMatchObject({ ok: true, state: { box: 2, due: addDays("2026-11-20", 3) } });
    const wrong = await recordReview(store, { question: "dueconcept#q1", result: "wrong" }, new Date(2026, 10, 21, 12));
    expect(wrong).toMatchObject({ ok: true, state: { box: 1, due: "2026-11-22" } });
  });

  it("refuses an unknown concept, an unknown question or an unreadable concept without appending", async () => {
    await fixtureStore();
    await writeFile(join(store, "concepts", "broken.md"), "not a concept");
    for (const question of ["nope#q1", "dueconcept#q9", "broken#q1", "Bad_Id#q1"]) {
      expect((await recordReview(store, { question, result: "right" })).ok, question).toBe(false);
    }
    expect(await readFile(join(store, "reviews.jsonl"), "utf8")).toBe("");
  });

  it("does not append to a malformed log", async () => {
    await fixtureStore();
    await writeFile(join(store, "reviews.jsonl"), "garbage\n");
    await expect(recordReview(store, { question: "dueconcept#q1", result: "right" })).rejects.toThrow(/line 1/);
    expect(await readFile(join(store, "reviews.jsonl"), "utf8")).toBe("garbage\n");
  });
});
