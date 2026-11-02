import { describe, expect, it } from "vitest";
import type { Concept } from "@arch-mind/rules/model";
import { groupedConcepts } from "@arch-mind/rules/fixtures";
import { layoutGrouped } from "../src/grouped-layout.ts";
import { buildGroupedScene } from "../src/grouped-scene.ts";
import { wireCode, wireStyle } from "../src/wire-code.ts";
import { NO_DOMAIN, groupConcepts, groupId, parseGroupId } from "../src/grouping.ts";

const concept = (id: string, layer: Concept["layer"], domains: string[], relations: [string, string][] = []): Concept => ({
  ...groupedConcepts[0]!,
  id,
  title: id,
  layer,
  domains,
  relations: relations.map(([to, type]) => ({ type, to, source: "https://example.org/s", explanation: "because" })),
});

describe("grouping (TST-044, AC-051, BR-009)", () => {
  it("puts a concept in the group of its first listed domain and one without domains in No domain", () => {
    const groups = groupConcepts([concept("a", "server", ["web", "models"]), concept("b", "server", ["models"]), concept("c", "server", [])]);
    expect(groups.map((g) => [g.id, g.members.map((m) => m.id)])).toEqual([
      [groupId("server", "web"), ["a"]],
      [groupId("server", "models"), ["b"]],
      [groupId("server", NO_DOMAIN), ["c"]],
    ]);
  });

  it("keeps the same domain on two layers as two groups, in plate order, with counts", () => {
    const groups = groupConcepts([concept("d", "data", ["web"]), concept("s1", "server", ["web"]), concept("s2", "server", ["web"])]);
    expect(groups.map((g) => [g.layer, g.domain, g.members.length])).toEqual([
      ["server", "web", 2],
      ["data", "web", 1],
    ]);
  });

  it("counts the grouped fixture's groups", () => {
    expect(groupConcepts(groupedConcepts).map((g) => `${g.layer}/${g.domain}:${g.members.length}`)).toEqual([
      "client/mobile:3",
      "client/web:1",
      "network/mobile:2",
      "network/No domain:1",
      "server/web:13",
      "server/models:2",
      "data/models:3",
    ]);
  });

  it("reads a group id back, including a domain that contains a colon", () => {
    expect(parseGroupId(groupId("data", "a:b"))).toEqual({ layer: "data", domain: "a:b" });
  });
});

describe("grouped edge model (TST-044, AC-052)", () => {
  const set = [
    concept("a1", "client", ["x"], [["b1", "uses"], ["b2", "uses"]]),
    concept("a2", "client", ["x"], [["b1", "sends"]]),
    concept("b1", "server", ["y"], [["a1", "uses"]]),
    concept("b2", "server", ["y"]),
    concept("c1", "data", ["z"], [["a1", "contains"]]),
  ];
  const edgeBetween = (layout: Awaited<ReturnType<typeof layoutGrouped>>, source: string, target: string) => layout.edges.filter((e) => e.source === source && e.target === target);
  const A = groupId("client", "x");
  const B = groupId("server", "y");
  const C = groupId("data", "z");

  it("merges relations into one counted edge per ordered pair, each direction separate", async () => {
    const layout = await layoutGrouped(set, null);
    expect(edgeBetween(layout, A, B).map((e) => e.label)).toEqual(["3"]);
    expect(edgeBetween(layout, B, A).map((e) => e.label)).toEqual(["uses"]);
    expect(edgeBetween(layout, C, A).map((e) => e.label)).toEqual(["contains"]);
    expect(layout.types[edgeBetween(layout, A, B)[0]!.id]).toEqual(["uses", "uses", "sends"]);
  });

  it("shows the shared type with the count when all relations have it", async () => {
    const layout = await layoutGrouped([set[0]!, { ...set[1]!, relations: [{ ...set[1]!.relations[0]!, type: "uses" }] }, set[2]!, set[3]!], null);
    expect(edgeBetween(layout, A, B).map((e) => e.label)).toEqual(["3 uses"]);
  });

  it("draws the open group's concepts and one edge between a concept of it and a closed group", async () => {
    const layout = await layoutGrouped(set, A);
    expect(layout.nodes.map((n) => n.id).sort()).toEqual([B, C, "a1", "a2"].sort());
    expect(edgeBetween(layout, "a1", B).map((e) => e.label)).toEqual(["2 uses"]);
    expect(edgeBetween(layout, "a2", B).map((e) => e.label)).toEqual(["sends"]);
    expect(edgeBetween(layout, B, "a1").map((e) => e.label)).toEqual(["uses"]);
    expect(edgeBetween(layout, C, "a1").map((e) => e.label)).toEqual(["contains"]);
    expect(layout.groups.find((g) => g.id === A)).toMatchObject({ open: true, count: 2 });
  });

  it("styles a connection of two contains relations as contains, not by its label text", async () => {
    const pair = [
      concept("p1", "client", ["x"], [["q1", "contains"]]),
      concept("p2", "client", ["x"], [["q2", "contains"]]),
      concept("q1", "server", ["y"], [["p1", "uses"], ["p2", "contains"]]),
      concept("q2", "server", ["y"]),
    ];
    const scene = buildGroupedScene(await layoutGrouped(pair, null));
    const wire = (source: string, target: string) => scene.wires.find((w) => w.source === source && w.target === target)!;
    const A = groupId("client", "x");
    const B = groupId("server", "y");
    expect(wire(A, B).label).toBe("2 contains");
    expect(wire(A, B).type).toBe("contains");
    expect(wireStyle(wireCode(wire(A, B).type!)).stroke).toBe("var(--wire-contains)");
    expect(wire(B, A).label).toBe("2");
    expect(wire(B, A).type).toBeNull();
  });
});
