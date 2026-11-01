import { describe, expect, it } from "vitest";
import { LAYERS, type Concept } from "@arch-mind/rules/model";
import { overWideConcepts, tst032Concepts, tst032RelationCount } from "@arch-mind/rules/fixtures";
import { layoutConcepts } from "../src/layout.ts";

describe("plate layout (TST-022, AC-024)", () => {
  it("places one node per concept and one routed, labeled edge per relation of the TST-032 fixture", async () => {
    const out = await layoutConcepts(tst032Concepts);
    expect(out.nodes).toHaveLength(13);
    expect(out.edges).toHaveLength(tst032RelationCount);
    for (const e of out.edges) {
      expect(e.label.length).toBeGreaterThan(0);
      expect(e.route.length).toBeGreaterThanOrEqual(2);
      expect(e.labelBox.width).toBeGreaterThan(0);
    }
  });

  it("keeps the four bands in layer order, apart, with every node and layer mark inside its own band", async () => {
    const out = await layoutConcepts(tst032Concepts);
    expect(out.bands.map((b) => b.layer)).toEqual([...LAYERS]);
    for (let i = 1; i < out.bands.length; i++) expect(out.bands[i]!.top).toBeGreaterThanOrEqual(out.bands[i - 1]!.bottom);
    for (const node of [...out.nodes, ...out.marks]) {
      const band = out.bands[LAYERS.indexOf(node.layer)]!;
      expect(node.y, node.id).toBeGreaterThanOrEqual(band.top);
      expect(node.y + node.height, node.id).toBeLessThanOrEqual(band.bottom);
      expect(node.x + node.width, node.id).toBeLessThanOrEqual(out.width);
    }
    expect(out.shown).toEqual({ client: 6, network: 5, server: 2, data: 0 });
  });

  it("keeps band order when a relation runs from a lower layer to a higher one", async () => {
    const upward = tst032Concepts
      .flatMap((c) => c.relations.map((r) => ({ from: c, to: tst032Concepts.find((t) => t.id === r.to)! })))
      .filter(({ from, to }) => LAYERS.indexOf(from.layer) > LAYERS.indexOf(to.layer));
    expect(upward.length).toBeGreaterThan(0);
    const out = await layoutConcepts(tst032Concepts);
    const tops = out.bands.map((b) => b.top);
    expect(tops).toEqual([...tops].sort((a, b) => a - b));
  });

  it("starts each route on a border of its source's cell and ends it on a border of its target's", async () => {
    const out = await layoutConcepts(tst032Concepts);
    const node = (id: string) => out.nodes.find((n) => n.id === id)!;
    const onBorder = (p: { x: number; y: number }, n: { x: number; y: number; width: number; height: number }) =>
      Math.abs(p.y - n.y) < 0.5 || Math.abs(p.y - (n.y + n.height)) < 0.5;
    for (const e of out.edges) {
      expect(onBorder(e.route[0]!, node(e.source)), `${e.id} start`).toBe(true);
      expect(onBorder(e.route[e.route.length - 1]!, node(e.target)), `${e.id} end`).toBe(true);
    }
  });

  it("gives a concept its own pictogram, or its layer's when it has none or an unknown id", async () => {
    const base = tst032Concepts[0]!;
    const out = await layoutConcepts([
      { ...base, id: "own", pictogram: "shield", relations: [] },
      { ...base, id: "none", pictogram: undefined, relations: [] },
      { ...base, id: "unknown", pictogram: "no-such-picture", relations: [] },
      { ...base, id: "elsewhere", layer: "data", pictogram: undefined, relations: [] },
    ]);
    expect(out.nodes.map((n) => n.pictogram)).toEqual(["shield", "client", "client", "data"]);
  });

  it("draws four bands for an empty store and ignores relations to unknown concepts", async () => {
    const empty = await layoutConcepts([]);
    expect(empty.nodes).toEqual([]);
    expect(empty.bands).toHaveLength(4);
    const lonely: Concept = { ...tst032Concepts[0]!, relations: [{ type: "x", to: "ghost", source: "s", explanation: "e" }] };
    const one = await layoutConcepts([lonely]);
    expect(one.nodes).toHaveLength(1);
    expect(one.edges).toEqual([]);
  });

  it("gives each concept a designator by layer", async () => {
    const out = await layoutConcepts(tst032Concepts);
    expect(out.nodes.filter((n) => n.layer === "client").map((n) => n.designator).sort()).toEqual(["C1", "C2", "C3", "C4", "C5", "C6"]);
    expect(out.nodes.find((n) => n.layer === "server" && n.designator === "S1")).toBeDefined();
  });

  it("carries each relation's source and explanation on its edge", async () => {
    const out = await layoutConcepts(tst032Concepts);
    const edge = out.edges.find((e) => e.source === "host-prefix" && e.target === "secure-attr")!;
    expect(edge.label).toBe("requires");
    expect(edge.citation).toContain("rfc6265bis");
    expect(edge.explanation).toContain("Secure attribute");
  });

  it("puts the 13 spokes of the over-wide fixture in one row", async () => {
    const out = await layoutConcepts(overWideConcepts);
    const spokes = out.nodes.filter((n) => n.layer === "server");
    expect(new Set(spokes.map((n) => Math.round(n.y))).size).toBe(1);
  });
});
