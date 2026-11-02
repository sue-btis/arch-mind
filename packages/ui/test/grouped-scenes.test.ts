import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LAYERS, type Concept } from "@arch-mind/rules/model";
import { groupedConcepts, overWideConcepts } from "@arch-mind/rules/fixtures";
import { layoutGrouped } from "../src/grouped-layout.ts";
import { buildGroupedScene } from "../src/grouped-scene.ts";
import { FIT_FLOOR, fitScale } from "../src/plates.ts";
import { expectSceneInvariants } from "./scene-checks.ts";

// 1366 px viewport minus the 16 px margins and the 200 px filters island.
const BOARD_WIDTH = 1118;
const byFileName = (concepts: Concept[]) => [...concepts].sort((a, b) => `${a.id}.md`.localeCompare(`${b.id}.md`));

const layerSubsets = () =>
  Array.from({ length: 15 }, (_, i) => i + 1).map((mask) => LAYERS.filter((_l, bit) => mask & (1 << bit)));

// The app only shows a state that fits, so the invariants are asserted on those; a group that would not fit stays closed.
describe.each([
  ["grouped", groupedConcepts],
  ["over-wide", overWideConcepts],
])("groups and routes come from elk, %s fixture (TST-046, R-10)", (_name, fixture) => {
  it.each(layerSubsets().map((layers) => [layers.join("+"), layers] as const))("keeps the scene invariants with layers %s, every group closed and each fitting group open alone", async (_label, layers) => {
    const sorted = byFileName(fixture.filter((c) => layers.includes(c.layer)));
    if (sorted.length === 0) return;
    const closed = await layoutGrouped(sorted, null);
    try {
      expectSceneInvariants(buildGroupedScene(closed), closed);
    } catch (error) {
      throw new Error(`all closed: ${(error as Error).message}`, { cause: error });
    }
    for (const g of closed.groups) {
      const layout = await layoutGrouped(sorted, g.id);
      const scene = buildGroupedScene(layout);
      if (fitScale(BOARD_WIDTH, scene.width) < FIT_FLOOR) continue;
      try {
        expectSceneInvariants(scene, layout);
      } catch (error) {
        throw new Error(`${g.id} open: ${(error as Error).message}`, { cause: error });
      }
    }
  });
});

describe("no hand-written router (TST-046, R-10)", () => {
  it("builds every grouped route from the elk edge sections", () => {
    const layout = readFileSync(new URL("../src/grouped-layout.ts", import.meta.url), "utf8");
    const scene = readFileSync(new URL("../src/grouped-scene.ts", import.meta.url), "utf8");
    expect(layout).toMatch(/\.sections!?\[0\]/);
    expect(layout).toMatch(/section\.startPoint, \.\.\.\(section\.bendPoints \?\? \[\]\), section\.endPoint/);
    expect(scene).not.toMatch(/bendPoints|route\s*[:=]/);
  });
});
