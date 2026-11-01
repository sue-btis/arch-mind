import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { addDays, localDate, setupStore, writeConceptAtomic } from "@arch-mind/rules";
import { tst032Concepts } from "@arch-mind/rules/fixtures";
import { startServer, type RunningServer } from "../src/app.ts";
import { writeLoadStore } from "./load-store.ts";

interface State {
  question: string;
  conceptId: string;
  text: string;
  box: number;
  due: string;
}

let dir: string;
let store: string;
let running: RunningServer;
let loadRunning: RunningServer;
const today = localDate();

const url = (server: RunningServer, path: string) => `http://127.0.0.1:${server.port}${path}`;
const post = (body: string, headers: Record<string, string> = {}) =>
  fetch(url(running, "/api/reviews"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: `http://127.0.0.1:${running.port}`, ...headers },
    body,
  });
const review = (question: string, result: string) => post(JSON.stringify({ question, result }));
const logText = () => readFile(join(store, "reviews.jsonl"), "utf8");

const withQuestions = (id: string, confirmed: string[]) => ({
  ...tst032Concepts[0]!,
  id,
  title: id,
  relations: [],
  recall: confirmed.map((c, i) => ({ id: `q${i + 1}`, question: `${id} question ${i + 1}?`, confirmed: c })),
});

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "arch-mind-reviews-"));
  store = await setupStore(join(dir, "store"), join(dir, "config.json"));
  await writeConceptAtomic(store, withQuestions("beta", [addDays(today, -1), today]));
  await writeConceptAtomic(store, withQuestions("alpha", [addDays(today, -3)]));
  await writeConceptAtomic(store, withQuestions("gamma", [today]));
  await writeFile(join(store, "concepts", "broken.md"), "not a concept");
  running = await startServer({ storePath: store, uiDir: join(dir, "ui"), port: 0 });
});

afterAll(async () => {
  await running?.close();
  await loadRunning?.close();
  await rm(dir, { recursive: true, force: true });
});

describe("GET /api/reviews/due (TST-018)", () => {
  it("lists the questions due today or earlier, ordered by due date then concept id then question", async () => {
    const res = await fetch(url(running, "/api/reviews/due"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as State[];
    expect(body).toEqual([
      { question: "alpha#q1", conceptId: "alpha", text: "alpha question 1?", box: 1, due: addDays(today, -2) },
      { question: "beta#q1", conceptId: "beta", text: "beta question 1?", box: 1, due: today },
    ]);
  });

  it("answers 405 to other methods", async () => {
    const res = await fetch(url(running, "/api/reviews/due"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: `http://127.0.0.1:${running.port}` },
      body: "{}",
    });
    expect(res.status).toBe(405);
  });
});

describe("POST /api/reviews (TST-018)", () => {
  beforeEach(async () => {
    await writeFile(join(store, "reviews.jsonl"), "");
  });

  it("records a right answer: 201 with box 2 and the next due date", async () => {
    const res = await review("alpha#q1", "right");
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ question: "alpha#q1", conceptId: "alpha", text: "alpha question 1?", box: 2, due: addDays(today, 3) });
    const lines = (await logText()).trim().split("\n");
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!)).toMatchObject({ question: "alpha#q1", result: "right" });
  });

  it("records a wrong answer: back to box 1, due tomorrow, and the question leaves the due list", async () => {
    await review("alpha#q1", "right");
    const res = await review("alpha#q1", "wrong");
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ box: 1, due: addDays(today, 1) });
    const due = (await (await fetch(url(running, "/api/reviews/due"))).json()) as State[];
    expect(due.map((s) => s.question)).toEqual(["beta#q1"]);
  });

  it.each([
    ["an unknown concept", "nope#q1"],
    ["an unknown question", "alpha#q9"],
    ["an unreadable concept file", "broken#q1"],
  ])("answers 404 for %s and appends nothing", async (_name, question) => {
    const res = await review(question, "right");
    expect(res.status).toBe(404);
    expect(typeof ((await res.json()) as { error: unknown }).error).toBe("string");
    expect(await logText()).toBe("");
  });

  it.each([
    ["not JSON", "{oops"],
    ["a JSON array", "[]"],
    ["a missing result", JSON.stringify({ question: "alpha#q1" })],
    ["a missing question", JSON.stringify({ result: "right" })],
    ["an extra key", JSON.stringify({ question: "alpha#q1", result: "right", at: "2026-01-01T00:00:00Z" })],
    ["a bad question pattern", JSON.stringify({ question: "Alpha#q1", result: "right" })],
    ["a bad result", JSON.stringify({ question: "alpha#q1", result: "maybe" })],
    ["a body over 16 KB", JSON.stringify({ question: "alpha#q1", result: "right", pad: "x".repeat(17 * 1024) })],
  ])("answers 400 with an error message for %s and appends nothing", async (_name, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(typeof ((await res.json()) as { error: unknown }).error).toBe("string");
    expect(await logText()).toBe("");
  });

  it("answers 415 for a body that is not application/json", async () => {
    const res = await post(JSON.stringify({ question: "alpha#q1", result: "right" }), { "Content-Type": "text/plain" });
    expect(res.status).toBe(415);
    expect(await logText()).toBe("");
  });

  it("answers 403 for a foreign or missing Origin, and appends nothing", async () => {
    const body = JSON.stringify({ question: "alpha#q1", result: "right" });
    expect((await post(body, { Origin: "http://evil.example" })).status).toBe(403);
    expect((await post(body, { Origin: `http://127.0.0.1:${running.port + 1}` })).status).toBe(403);
    const noOrigin = await fetch(url(running, "/api/reviews"), { method: "POST", headers: { "Content-Type": "application/json" }, body });
    expect(noOrigin.status).toBe(403);
    expect(await logText()).toBe("");
  });

  it("lets a malformed log fail with 500 instead of appending to it", async () => {
    await writeFile(join(store, "reviews.jsonl"), "garbage\n");
    expect((await review("alpha#q1", "right")).status).toBe(500);
    expect(await logText()).toBe("garbage\n");
  });
});

describe("TST-019: due list under load (NFR-006)", () => {
  it("answers within 2 s for 300 concepts, 600 questions and a year of reviews", async () => {
    const loadDir = await mkdtemp(join(tmpdir(), "arch-mind-load-"));
    try {
      const loadStore = await setupStore(join(loadDir, "store"), join(loadDir, "config.json"));
      const generated = await writeLoadStore(loadStore, today);
      expect(generated).toEqual({ questions: 600, reviewLines: 7200 });
      loadRunning = await startServer({ storePath: loadStore, uiDir: join(loadDir, "ui"), port: 0 });

      const timings: number[] = [];
      let due: State[] = [];
      for (let i = 0; i < 5; i++) {
        const started = performance.now();
        const res = await fetch(url(loadRunning, "/api/reviews/due"));
        due = (await res.json()) as State[];
        timings.push(performance.now() - started);
        expect(res.status).toBe(200);
      }
      process.stdout.write(`TST-019 GET /api/reviews/due: ${due.length} due of ${generated.questions}; ms per request ${timings.map((t) => t.toFixed(0)).join(", ")}\n`);
      expect(due.length).toBeGreaterThan(0);
      expect(Math.max(...timings)).toBeLessThanOrEqual(2000);
    } finally {
      await loadRunning?.close();
      await rm(loadDir, { recursive: true, force: true });
    }
  });
});
