import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupStore, writeConceptAtomic } from "@arch-mind/rules";
import { tst032Concepts } from "@arch-mind/rules/fixtures";
import { startServer, type RunningServer } from "../src/app.ts";

let dir: string;
let running: RunningServer;

const get = (path: string) => fetch(`http://127.0.0.1:${running.port}${path}`);

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "arch-mind-detail-"));
  const store = await setupStore(join(dir, "store"), join(dir, "config.json"));
  for (const concept of tst032Concepts) await writeConceptAtomic(store, concept);
  await writeFile(join(store, "concepts", "broken.md"), "not a concept");
  await writeFile(
    join(store, "reviews.jsonl"),
    `${JSON.stringify({ question: "secure-attr#q1", at: new Date(2026, 10, 1, 12).toISOString(), result: "right" })}\n`,
  );
  running = await startServer({ storePath: store, uiDir: join(dir, "ui"), port: 0 });
});

afterAll(async () => {
  await running.close();
  await rm(dir, { recursive: true, force: true });
});

describe("GET /api/concepts/{id} (TST-015, AC-6, AC-8)", () => {
  it("answers the concept with each question's replayed box and due date", async () => {
    const res = await get("/api/concepts/secure-attr");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { concept: { id: string }; questions: { question: string; box: number; due: string }[] };
    expect(body.concept.id).toBe("secure-attr");
    expect(body.questions).toEqual([expect.objectContaining({ question: "secure-attr#q1", conceptId: "secure-attr", box: 2, due: "2026-11-04" })]);
    const fresh = (await (await get("/api/concepts/host-prefix")).json()) as { questions: { box: number; due: string }[] };
    expect(fresh.questions[0]).toMatchObject({ box: 1, due: "2026-10-31" });
  });

  it.each(["no-such-concept", "Bad_Id", "broken"])("answers 404 with an error message for %s", async (id) => {
    const res = await get(`/api/concepts/${id}`);
    expect(res.status).toBe(404);
    expect(typeof ((await res.json()) as { error: unknown }).error).toBe("string");
  });

  it("lists the unreadable file in the concepts response", async () => {
    const body = (await (await get("/api/concepts")).json()) as { problems: { file: string; reason: string }[] };
    expect(body.problems).toEqual([expect.objectContaining({ file: "broken.md" })]);
  });
});
