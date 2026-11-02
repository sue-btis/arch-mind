import { describe, expect, it } from "vitest";
import { tst032Concepts } from "@arch-mind/rules/fixtures";
import { neighbourhood } from "../src/neighbourhood.ts";

const byId = (id: string) => tst032Concepts.find((c) => c.id === id)!;

describe("neighbourhood of a selection (TST-026, AC-029, AC-031)", () => {
  it("lists the outgoing relations with their source and explanation", () => {
    const hood = neighbourhood(tst032Concepts, "host-prefix")!;
    expect(hood.incoming).toEqual([]);
    expect(hood.outgoing).toEqual([
      { source: "host-prefix", target: "secure-attr", type: "requires", citation: byId("host-prefix").relations[0]!.source, explanation: byId("host-prefix").relations[0]!.explanation },
    ]);
    expect(hood.connected).toEqual(["secure-attr"]);
  });

  it("lists the incoming relations of the concepts that point at the selection", () => {
    const hood = neighbourhood(tst032Concepts, "secure-attr")!;
    const pointing = tst032Concepts.filter((c) => c.relations.some((r) => r.to === "secure-attr")).map((c) => c.id);
    expect(hood.incoming.map((e) => e.source).sort()).toEqual(pointing.sort());
    expect(hood.incoming.every((e) => e.target === "secure-attr")).toBe(true);
    expect(hood.connected).toEqual(expect.arrayContaining([...pointing, ...hood.outgoing.map((e) => e.target)]));
  });

  it("connects concepts across layers and never lists the selection as its own neighbour", () => {
    const hood = neighbourhood(tst032Concepts, "secure-context")!;
    const layers = new Set(hood.connected.map((id) => byId(id).layer));
    expect(layers.size).toBeGreaterThan(1);
    expect(hood.connected).not.toContain("secure-context");
    expect(new Set(hood.connected).size).toBe(hood.connected.length);
  });

  it("ignores a relation from a concept to itself", () => {
    const loop = { ...byId("host-prefix"), relations: [{ ...byId("host-prefix").relations[0]!, to: "host-prefix" }] };
    expect(neighbourhood([loop], "host-prefix")).toEqual({ id: "host-prefix", outgoing: [], incoming: [], connected: [] });
  });

  it("is empty for a concept with no relations", () => {
    const alone = { ...byId("host-prefix"), relations: [] };
    expect(neighbourhood([alone], "host-prefix")).toEqual({ id: "host-prefix", outgoing: [], incoming: [], connected: [] });
  });

  it("is null for an id that is not shown, and drops relations to concepts that are not shown", () => {
    const shown = tst032Concepts.filter((c) => c.id !== "secure-attr");
    expect(neighbourhood(shown, "secure-attr")).toBeNull();
    expect(neighbourhood(shown, "host-prefix")!.outgoing).toEqual([]);
  });
});
