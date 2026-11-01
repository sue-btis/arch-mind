import { mkdtemp, readFile, rm, unlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tst032Concepts } from "../fixtures/tst-032.ts";

vi.mock("../src/concept-file.ts", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/concept-file.ts")>();
  return { ...original, parseConcept: vi.fn(original.parseConcept) };
});

const { parseConcept } = await import("../src/concept-file.ts");
const { extendConcept, loadConcept, loadConcepts, setupStore, writeConceptAtomic } = await import("../src/index.ts");
const parses = vi.mocked(parseConcept);

describe("concept parse cache", () => {
  let dir: string;
  let store: string;
  const file = (id: string) => join(store, "concepts", `${id}.md`);

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "arch-mind-cache-"));
    store = await setupStore(join(dir, "store"), join(dir, "config.json"));
    for (const concept of tst032Concepts.slice(0, 3)) await writeConceptAtomic(store, concept);
    parses.mockClear();
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it("parses each file once and not again while it is unchanged", async () => {
    const first = await loadConcepts(store);
    expect(parses).toHaveBeenCalledTimes(3);
    const second = await loadConcepts(store);
    await loadConcept(store, tst032Concepts[0]!.id);
    expect(parses).toHaveBeenCalledTimes(3);
    expect(second).toEqual(first);
  });

  it("shares one parse between loads that run at the same time on a cold cache", async () => {
    const [a, b] = await Promise.all([loadConcepts(store), loadConcepts(store)]);
    expect(parses).toHaveBeenCalledTimes(3);
    expect(b).toEqual(a);
  });

  it("hands out copies, so a caller cannot change what later loads return", async () => {
    const { concepts } = await loadConcepts(store);
    concepts[0]!.title = "changed by a caller";
    expect((await loadConcepts(store)).concepts[0]!.title).not.toBe("changed by a caller");
  });

  it("re-parses a file that was edited by hand", async () => {
    const id = tst032Concepts[1]!.id;
    await loadConcepts(store);
    parses.mockClear();
    await writeFile(file(id), (await readFile(file(id), "utf8")).replace(/title: .*/, "title: Edited by hand"));
    const { concepts } = await loadConcepts(store);
    expect(parses).toHaveBeenCalledTimes(1);
    expect(concepts.find((c) => c.id === id)?.title).toBe("Edited by hand");
  });

  it("re-parses a file whose size is unchanged but whose mtime moved", async () => {
    const id = tst032Concepts[1]!.id;
    await loadConcepts(store);
    parses.mockClear();
    const when = new Date(Date.now() + 60_000);
    await utimes(file(id), when, when);
    await loadConcepts(store);
    expect(parses).toHaveBeenCalledTimes(1);
  });

  it("drops a deleted file and picks up a new one", async () => {
    await loadConcepts(store);
    await unlink(file(tst032Concepts[0]!.id));
    await writeConceptAtomic(store, tst032Concepts[5]!);
    const ids = (await loadConcepts(store)).concepts.map((c) => c.id).sort();
    expect(ids).toEqual([tst032Concepts[1]!.id, tst032Concepts[2]!.id, tst032Concepts[5]!.id].sort());
    expect((await loadConcept(store, tst032Concepts[0]!.id)).ok).toBe(false);
  });

  it("reports a file that becomes broken on every load and never serves its old content", async () => {
    const id = tst032Concepts[1]!.id;
    await loadConcepts(store);
    await writeFile(file(id), "not a concept");
    for (let i = 0; i < 2; i++) {
      const { concepts, problems } = await loadConcepts(store);
      expect(problems.map((p) => p.file)).toEqual([`${id}.md`]);
      expect(concepts.map((c) => c.id)).not.toContain(id);
      expect((await loadConcept(store, id)).ok).toBe(false);
    }
  });

  it("shows what extendConcept saved in the same process", async () => {
    const target = tst032Concepts[0]!;
    await loadConcepts(store);
    const outcome = await extendConcept(store, { id: target.id, episodes: [{ project: "arch-mind", situation: "Seen again after the cache was warm." }] });
    expect(outcome.ok).toBe(true);
    const reloaded = (await loadConcepts(store)).concepts.find((c) => c.id === target.id);
    expect(reloaded?.episodes.map((e) => e.situation)).toContain("Seen again after the cache was warm.");
  });
});
