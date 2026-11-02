import { describe, expect, it } from "vitest";
import type { Concept } from "@arch-mind/rules/model";
import { tst032Concepts } from "@arch-mind/rules/fixtures";
import { NO_FILTERS, filterConcepts } from "../src/filter.ts";
import { clearHidingFacets, findConcepts } from "../src/finder.ts";
import { designators } from "../src/layout.ts";
import { neighbourhood } from "../src/neighbourhood.ts";
import { cellProminence, wireProminence } from "../src/prominence.ts";

const ids = (q: string, concepts: Concept[] = tst032Concepts) => findConcepts(concepts, q).map((m) => m.concept.id);
const names = designators(tst032Concepts);

describe("finder matching (TST-036, AC-042a)", () => {
  it("matches a designator of the whole-store numbering, case-insensitively, and puts it first", () => {
    const server2 = [...names].find(([, d]) => d === "S2")![0];
    const hits = findConcepts(tst032Concepts, "s2");
    expect(hits[0]).toMatchObject({ designator: "S2", concept: { id: server2 } });
    expect(hits.every((m) => m.designator.toLowerCase().includes("s2") || m.concept.title.toLowerCase().includes("s2"))).toBe(true);
  });

  it("ranks a title prefix before a title substring", () => {
    const hits = findConcepts(tst032Concepts, "secure");
    const titles = hits.map((m) => m.concept.title.toLowerCase());
    const firstSubstring = titles.findIndex((t) => !t.startsWith("secure"));
    expect(titles.slice(0, firstSubstring).every((t) => t.startsWith("secure"))).toBe(true);
    expect(firstSubstring).toBeGreaterThan(0);
    expect(titles.slice(firstSubstring).every((t) => t.includes("secure"))).toBe(true);
  });

  it("ranks a designator match, then a title prefix, then a title substring, against store order", () => {
    const base = tst032Concepts[0]!;
    const q = `${base.layer[0]}3`;
    const make = (id: string, title: string): Concept => ({ ...base, id, title, relations: [] });
    const store = [make("substring", `Has ${q} inside`), make("prefix", `${q} prefix`), make("designated", "Plain title")];
    expect(findConcepts(store, q).map((m) => m.concept.id)).toEqual(["designated", "prefix", "substring"]);
  });

  it("does not match words that occur only in SEE-I, episodes or relations", () => {
    const only = { ...tst032Concepts[0]!, id: "only-seei", title: "Plain title", seeI: { ...tst032Concepts[0]!.seeI, statement: "Zebrafoo lives here." }, episodes: [{ project: "p", situation: "Zebrafoo", date: "2026-10-30" }] };
    const store = [...tst032Concepts, only];
    expect(ids("zebrafoo", store)).toEqual([]);
    expect(ids("plain", store)).toEqual(["only-seei"]);
    expect(ids("sent only over")).toEqual([]);
  });

  it("still matches a concept the filters hide, under its whole-store designator", () => {
    const filtered = filterConcepts(tst032Concepts, { ...NO_FILTERS, layers: ["client"] });
    const hidden = tst032Concepts.find((c) => c.layer === "server")!;
    expect(filtered.some((c) => c.id === hidden.id)).toBe(false);
    expect(findConcepts(tst032Concepts, hidden.title)[0]).toMatchObject({ designator: names.get(hidden.id), concept: { id: hidden.id } });
  });

  it("lists every concept for an empty query", () => {
    expect(ids("  ")).toEqual(tst032Concepts.map((c) => c.id));
  });
});

describe("facets that hide a chosen concept (AC-042c)", () => {
  const web: Concept = { ...tst032Concepts[0]!, layer: "server", domains: ["web"], concerns: ["security"] };
  it("resets only the facets that exclude it", () => {
    expect(clearHidingFacets(web, { layers: ["client"], domains: ["web"], concerns: ["performance"] })).toEqual({ layers: [], domains: ["web"], concerns: [] });
    expect(clearHidingFacets(web, NO_FILTERS)).toEqual(NO_FILTERS);
  });
});

describe("shared prominence of the selection and the legend type (AC-043)", () => {
  const hood = neighbourhood(tst032Concepts, "secure-attr")!;
  const wire = (source: string, target: string, label: string) => ({ source, target, label });

  it("leaves everything alone without a selection or a type", () => {
    expect(wireProminence(null, null, wire("a", "b", "requires"))).toBeUndefined();
  });

  it("keeps only the type with no selection, treating unknown types as one kind", () => {
    expect(wireProminence(null, "requires", wire("a", "b", "Requires"))).toBe("near");
    expect(wireProminence(null, "requires", wire("a", "b", "complements"))).toBe("far");
    expect(wireProminence(null, "other", wire("a", "b", "sent only over"))).toBe("near");
    expect(wireProminence(null, "other", wire("a", "b", "requires"))).toBe("far");
  });

  it("keeps a wire only when it touches the selection and is of the type", () => {
    expect(wireProminence(hood, null, wire("secure-attr", "x", "requires"))).toBe("near");
    expect(wireProminence(hood, null, wire("p", "q", "requires"))).toBe("far");
    expect(wireProminence(hood, "requires", wire("secure-attr", "x", "complements"))).toBe("far");
    expect(wireProminence(hood, "requires", wire("secure-attr", "x", "requires"))).toBe("near");
    expect(wireProminence(hood, "requires", wire("p", "q", "requires"))).toBe("far");
  });

  it("applies the same rule to a matrix cell with several relations", () => {
    const rel = (type: string) => ({ type, to: "x", source: "s", explanation: "e" });
    expect(cellProminence(null, "contains", "a", "b", [rel("requires"), rel("contains")])).toBe("near");
    expect(cellProminence(null, "contains", "a", "b", [rel("requires")])).toBe("far");
    expect(cellProminence(null, null, "a", "b", [])).toBeUndefined();
    expect(cellProminence(hood, "requires", "secure-attr", "b", [rel("requires")])).toBe("near");
    expect(cellProminence(hood, "requires", "p", "q", [rel("requires")])).toBe("far");
    expect(cellProminence(hood, null, "p", "q", [])).toBe("far");
  });
});
