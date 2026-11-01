import { describe, expect, it } from "vitest";
import type { Concept } from "@arch-mind/rules/model";
import { tst032Concepts, tst032RelationCount } from "@arch-mind/rules/fixtures";
import { NO_FILTERS, filterConcepts, hasFilters } from "../src/filter.ts";

const relationCount = (concepts: Concept[]) => concepts.reduce((n, c) => n + c.relations.length, 0);
const mixed: Concept[] = tst032Concepts.map((c, i) => ({
  ...c,
  domains: i % 2 === 0 ? ["web"] : ["mobile"],
  concerns: i % 3 === 0 ? ["security"] : ["performance"],
}));

describe("facet filters (TST-012, AC-1)", () => {
  it("keeps every concept and relation when nothing is selected", () => {
    expect(hasFilters(NO_FILTERS)).toBe(false);
    const out = filterConcepts(tst032Concepts, NO_FILTERS);
    expect(out).toHaveLength(13);
    expect(relationCount(out)).toBe(tst032RelationCount);
  });

  it("combines values of one facet with OR", () => {
    const client = filterConcepts(tst032Concepts, { ...NO_FILTERS, layers: ["client"] });
    const clientOrServer = filterConcepts(tst032Concepts, { ...NO_FILTERS, layers: ["client", "server"] });
    expect(client.every((c) => c.layer === "client")).toBe(true);
    expect(clientOrServer.length).toBeGreaterThan(client.length);
    expect(new Set(clientOrServer.map((c) => c.layer))).toEqual(new Set(["client", "server"]));
  });

  it("combines facets with AND and lets an empty facet leave the others alone", () => {
    const web = filterConcepts(mixed, { ...NO_FILTERS, domains: ["web"] });
    const webSecurity = filterConcepts(mixed, { ...NO_FILTERS, domains: ["web"], concerns: ["security"] });
    expect(web.every((c) => c.domains.includes("web"))).toBe(true);
    expect(webSecurity.length).toBeLessThan(web.length);
    expect(webSecurity.every((c) => c.domains.includes("web") && c.concerns.includes("security"))).toBe(true);
    const serverOnly = filterConcepts(mixed, { layers: ["server"], domains: [], concerns: [] });
    expect(serverOnly.length).toBeGreaterThan(0);
    expect(serverOnly.every((c) => c.layer === "server")).toBe(true);
  });

  it("matches a concept holding several values when any one is selected", () => {
    const multi = [{ ...tst032Concepts[0]!, domains: ["web", "models"] }];
    expect(filterConcepts(multi, { ...NO_FILTERS, domains: ["models"] })).toHaveLength(1);
    expect(filterConcepts(multi, { ...NO_FILTERS, domains: ["mobile"] })).toHaveLength(0);
  });

  it("keeps a relation only when both ends match", () => {
    for (const layers of [["client"], ["network", "server"]] as const) {
      const out = filterConcepts(tst032Concepts, { ...NO_FILTERS, layers: [...layers] });
      const ids = new Set(out.map((c) => c.id));
      expect(out.flatMap((c) => c.relations).every((r) => ids.has(r.to))).toBe(true);
    }
    expect(relationCount(filterConcepts(tst032Concepts, { ...NO_FILTERS, layers: ["client"] }))).toBeLessThan(tst032RelationCount);
  });
});
