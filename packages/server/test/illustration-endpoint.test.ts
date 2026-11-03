import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { saveConcept, setupStore, writeConceptAtomic, type Concept } from "@arch-mind/rules";
import { startServer, type RunningServer } from "../src/app.ts";

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#cde"/></svg>';
const SCRIPTED = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';

let dir: string;
let store: string;
let running: RunningServer;

const base = (id: string, illustration: string): Concept => ({
  id,
  title: id,
  layer: "server",
  domains: ["web"],
  concerns: ["security"],
  seeI: { statement: "s", elaboration: "e", example: "x", illustration },
  relations: [],
  episodes: [],
  recall: [{ id: "q1", question: "q?", confirmed: "2026-11-01" }],
});

const get = (path: string, init?: RequestInit) => fetch(`http://127.0.0.1:${running.port}${path}`, init);

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "arch-mind-illustration-endpoint-"));
  store = await setupStore(join(dir, "store"), join(dir, "config.json"));
  const saved = await saveConcept(store, {
    id: "drawn",
    title: "Drawn",
    layer: "server",
    domains: ["web"],
    concerns: ["security"],
    seeI: { statement: "s", elaboration: "e", example: "x", illustration: "A grey square." },
    relations: [],
    recall: [{ question: "q?" }],
    illustration: SVG,
  });
  if (!saved.ok) throw new Error(JSON.stringify(saved.errors));
  await writeConceptAtomic(store, base("plain", "No picture."));
  await writeConceptAtomic(store, base("scripted", "Text.\n\n![x](../illustrations/scripted.svg)"));
  await writeConceptAtomic(store, base("missing", "Text.\n\n![x](../illustrations/missing.svg)"));
  await writeConceptAtomic(store, base("double", "Text.\n\n![x](../illustrations/double.svg)\n\n![y](../illustrations/double.svg)"));
  await writeFile(join(store, "illustrations", "scripted.svg"), SCRIPTED);
  await writeFile(join(store, "illustrations", "double.svg"), SVG);
  running = await startServer({ storePath: store, uiDir: join(dir, "ui"), port: 0 });
});

afterAll(async () => {
  await running.close();
  await rm(dir, { recursive: true, force: true });
});

describe("GET /api/concepts/{id}/illustration (TST-033, AC-039)", () => {
  it("serves a valid illustration as image/svg+xml with the restrictive CSP and nosniff", async () => {
    const res = await get("/api/concepts/drawn/illustration");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/svg+xml");
    expect(res.headers.get("content-security-policy")).toBe("default-src 'none'; style-src 'unsafe-inline'; sandbox");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await res.text()).toBe(SVG);
  });

  it.each(["no-such-concept", "Bad_Id", "plain", "scripted", "missing", "double"])("answers 404 for %s", async (id) => {
    const res = await get(`/api/concepts/${id}/illustration`);
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.headers.get("content-security-policy")).toBeNull();
  });

  it("answers 404 after the SVG disappears and 200 again once it is back, without a restart", async () => {
    const file = join(store, "illustrations", "drawn.svg");
    await rm(file);
    expect((await get("/api/concepts/drawn/illustration")).status).toBe(404);
    await writeFile(file, SVG);
    expect((await get("/api/concepts/drawn/illustration")).status).toBe(200);
  });

  it("keeps the read-only guard: a write method is refused", async () => {
    const res = await get("/api/concepts/drawn/illustration", {
      method: "POST",
      headers: { Origin: `http://127.0.0.1:${running.port}`, "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(405);
  });
});

describe("link stripping and hasIllustration over HTTP (TST-033, AC-039)", () => {
  it("reaches the UI without the Markdown image link in the detail and the list", async () => {
    const detail = (await (await get("/api/concepts/drawn")).json()) as { concept: { seeI: { illustration: string }; hasIllustration: boolean } };
    expect(detail.concept.seeI.illustration).toBe("A grey square.");
    expect(detail.concept.hasIllustration).toBe(true);

    const list = (await (await get("/api/concepts")).json()) as { concepts: { id: string; hasIllustration: boolean; seeI: { illustration: string } }[]; problems: { file: string }[] };
    const byId = Object.fromEntries(list.concepts.map((c) => [c.id, c]));
    expect(byId.drawn).toMatchObject({ hasIllustration: true });
    for (const c of list.concepts) expect(c.seeI.illustration, c.id).not.toContain("![");
    expect(byId.scripted).toMatchObject({ hasIllustration: false });
    expect(byId.missing).toMatchObject({ hasIllustration: false });
    expect(byId.double).toMatchObject({ hasIllustration: false });
    expect(byId.plain).toMatchObject({ hasIllustration: false });
    expect(list.problems.map((p) => p.file).sort()).toEqual(["double.md", "missing.md", "scripted.md"]);
  });

  it("does not alter the file on disk", async () => {
    const { loadConcept } = await import("@arch-mind/rules");
    const stored = (await loadConcept(store, "drawn")) as { concept: Concept };
    expect(stored.concept.seeI.illustration).toContain("![Illustration of Drawn](../illustrations/drawn.svg)");
  });
});
