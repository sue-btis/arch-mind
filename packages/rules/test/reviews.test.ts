import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
    expect(validConcept(body.concept), JSON.stringify(validConcept.errors)).toBe(true);
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
