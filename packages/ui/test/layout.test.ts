import { describe, expect, it } from "vitest";
import { LAYERS, type Concept } from "@arch-mind/rules/model";
import { tst032Concepts, tst032RelationCount } from "@arch-mind/rules/fixtures";
import { layoutConcepts } from "../src/layout.ts";

const MAX_WIDTH = 1366;

describe("layer view layout (TST-008 geometry, AC-7, AC-8)", () => {
  it("lays the TST-032 fixture out within 1366 px, one node per concept and one edge per relation", async () => {
    const out = await layoutConcepts(tst032Concepts);
    console.log(`TST-032 layout: ${out.width} x ${out.height} px`);
    expect(out.width).toBeLessThanOrEqual(MAX_WIDTH);
    expect(out.nodes).toHaveLength(13);
    expect(out.edges).toHaveLength(tst032RelationCount);
    expect(out.edges.every((e) => e.label.length > 0)).toBe(true);
  });

  it("always draws the four bands in order without overlap and keeps each concept in its band", async () => {
    const out = await layoutConcepts(tst032Concepts);
    expect(out.bands.map((b) => b.layer)).toEqual([...LAYERS]);
    for (let i = 1; i < out.bands.length; i++) {
      expect(out.bands[i]!.y).toBeGreaterThanOrEqual(out.bands[i - 1]!.y + out.bands[i - 1]!.height);
    }
    for (const node of out.nodes) {
      const band = out.bands.find((b) => b.layer === node.layer)!;
      expect(node.y).toBeGreaterThanOrEqual(band.y);
      expect(node.y + node.height).toBeLessThanOrEqual(band.y + band.height);
    }
    const data = out.bands.find((b) => b.layer === "data")!;
    expect(data.height).toBeLessThan(out.bands.find((b) => b.layer === "server")!.height);
  });

  it("keeps band order when a relation runs from a lower layer to a higher one (ASM-3)", async () => {
    const upward = tst032Concepts.flatMap((c) => c.relations.map((r) => ({ from: c, to: tst032Concepts.find((t) => t.id === r.to)! })))
      .filter(({ from, to }) => LAYERS.indexOf(from.layer) > LAYERS.indexOf(to.layer));
    expect(upward.length).toBeGreaterThan(0);
    const out = await layoutConcepts(tst032Concepts);
    const y = (layer: string) => out.bands.find((b) => b.layer === layer)!.y;
    expect(y("client")).toBeLessThan(y("network"));
    expect(y("network")).toBeLessThan(y("server"));
    expect(y("server")).toBeLessThan(y("data"));
  });

  it("draws four thin bands for an empty store and ignores relations to unknown concepts", async () => {
    const empty = await layoutConcepts([]);
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
});
