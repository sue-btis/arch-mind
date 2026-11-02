import { describe, expect, it } from "vitest";
import type { Concept } from "@arch-mind/rules/model";
import { groupedConcepts, overWideConcepts } from "@arch-mind/rules/fixtures";
import { layoutConcepts } from "../src/layout.ts";
import { layoutGrouped } from "../src/grouped-layout.ts";
import { buildGroupedScene } from "../src/grouped-scene.ts";
import { FIT_FLOOR, buildScene, fitScale } from "../src/plates.ts";
import { expectSceneInvariants } from "./scene-checks.ts";

// 1366 px viewport minus the 16 px margins and the 200 px filters island.
const BOARD_WIDTH = 1118;

const byFileName = (concepts: Concept[]) => [...concepts].sort((a, b) => `${a.id}.md`.localeCompare(`${b.id}.md`));

async function grouped(concepts: Concept[], open: string | null) {
  const layout = await layoutGrouped(byFileName(concepts), open);
  const scene = buildGroupedScene(layout);
  return { layout, scene, fit: fitScale(BOARD_WIDTH, scene.width) };
}

const fixtures = { "over-wide": overWideConcepts, grouped: groupedConcepts };

describe("grouped fixture (R-1)", () => {
  it("is refused by the flat layer view at the 1118 px free width", async () => {
    const flat = buildScene(await layoutConcepts(byFileName(groupedConcepts)));
    expect(fitScale(BOARD_WIDTH, flat.width)).toBeLessThan(FIT_FLOOR);
  });
});

describe.each(Object.entries(fixtures))("ADR-010 probe on the %s fixture (TST-043)", (name, concepts) => {
  it("closed: every group closed fits at 0.85 or more without sideways scroll and passes the scene checks", async () => {
    const { layout, scene, fit } = await grouped(concepts, null);
    process.stdout.write(`probe ${name}, all closed: Fit ${fit.toFixed(3)} (width ${Math.round(scene.width)})\n`);
    expect(fit).toBeGreaterThanOrEqual(FIT_FLOOR);
    expect(scene.width * fit).toBeLessThanOrEqual(BOARD_WIDTH + 0.5);
    expectSceneInvariants(scene, layout);
  });

  it("opened alone: each group either fits at 0.85 or more with the checks passing, or is reported as not fitting", async () => {
    const closed = await grouped(concepts, null);
    const failures: string[] = [];
    for (const g of closed.layout.groups) {
      const { layout, scene, fit } = await grouped(concepts, g.id);
      const fits = fit >= FIT_FLOOR;
      process.stdout.write(`probe ${name}, ${g.id} (${g.count}) open: Fit ${fit.toFixed(3)} ${fits ? "fits" : "does not fit"}\n`);
      if (!fits) continue;
      try {
        expectSceneInvariants(scene, layout);
      } catch (error) {
        failures.push(`${g.id}: ${(error as Error).message}`);
      }
    }
    expect(failures).toEqual([]);
  });
});
