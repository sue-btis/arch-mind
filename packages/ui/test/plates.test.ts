import { beforeAll, describe, expect, it } from "vitest";
import { LAYERS, type Concept, type Layer } from "@arch-mind/rules/model";
import { overWideConcepts, tst032Concepts } from "@arch-mind/rules/fixtures";
import { layoutConcepts, type PlateLayout } from "../src/layout.ts";
import {
  FIT_FLOOR,
  SHEAR,
  SQUASH,
  buildScene,
  clampOrigin,
  fitScale,
  homeOrigin,
  isRefused,
  labelLines,
  revealBox,
  segmentHitsBox,
  viewFor,
  wrapText,
  zoomAround,
  type Box,
  type Scene,
} from "../src/plates.ts";
import {
  closeParallels,
  expectApart,
  expectDrops,
  expectGapChips,
  expectInsideBounds,
  expectLabelsOnOwnWire,
  expectNoLabelCrossing,
  expectNoPlateEdgeRun,
  expectNoSharedLine,
  expectNoThroughWires,
  expectStacked,
  expectWireEnds,
} from "./scene-checks.ts";

// 1366 px viewport minus the 16 px margins and the 200 px filters island (R-4).
const BOARD_WIDTH = 1118;

// The server lists concept files in name order, so the plates are drawn from the same order here.
const byFileName = (concepts: Concept[]) => [...concepts].sort((a, b) => `${a.id}.md`.localeCompare(`${b.id}.md`));
const draw = async (concepts: Concept[], name?: string) => {
  const layout = await layoutConcepts(byFileName(concepts));
  if (name) layouts.set(name, layout);
  return buildScene(layout);
};

const subsets: Layer[][] = Array.from({ length: 16 }, (_, mask) => LAYERS.filter((_layer, i) => mask & (1 << i)));
const only = (layers: Layer[]) => (layers.length === 0 ? [] : tst032Concepts.filter((c) => layers.includes(c.layer)));
const scenes = new Map<string, Scene>();
const layouts = new Map<string, PlateLayout>();
let timing = 0;

beforeAll(async () => {
  const started = performance.now();
  scenes.set("full", await draw(tst032Concepts, "full"));
  timing = performance.now() - started;
  for (const layers of subsets) scenes.set(layers.join("+") || "none", await draw(only(layers), layers.join("+") || "none"));
  process.stdout.write(`TST-032 layout and projection: ${Math.round(timing)} ms\n`);
});

describe("projection and Fit (TST-022, AC-024, AC-026)", () => {
  it("derives the 0.85 floor from the readable label and pictogram sizes", () => {
    expect(FIT_FLOOR).toBe(0.85);
  });

  it("scales to min(1, board width / projected width) and refuses only below the floor", () => {
    expect(fitScale(1000, 800)).toBe(1);
    expect(fitScale(800, 1000)).toBe(0.8);
    expect(fitScale(1000, 0)).toBe(1);
    expect(isRefused(0.85)).toBe(false);
    expect(isRefused(0.849)).toBe(true);
    expect(isRefused(fitScale(850, 1000))).toBe(false);
    expect(isRefused(fitScale(849, 1000))).toBe(true);
  });

  it("fits the TST-032 chain at the reference board width at a scale of at least 0.85", () => {
    const s = scenes.get("full")!;
    expect(fitScale(BOARD_WIDTH, s.width)).toBeGreaterThanOrEqual(FIT_FLOOR);
  });

  it("lays out and projects the TST-032 chain in well under a second", () => {
    expect(timing).toBeLessThan(500);
  });

  it("refuses the over-wide fixture, and draws the one concept a narrower filter leaves", async () => {
    expect(isRefused(fitScale(BOARD_WIDTH, (await draw(overWideConcepts)).width))).toBe(true);
    const narrowed = await draw(overWideConcepts.filter((c) => c.layer === "client"));
    expect(isRefused(fitScale(BOARD_WIDTH, narrowed.width))).toBe(false);
  });

  it("projects a plate point with the shear and the squash", async () => {
    const s = scenes.get("client")!;
    const [back, , , front] = s.plates[0]!.corners;
    const depthOnScreen = front!.y - back!.y;
    const shearOnScreen = back!.x - front!.x;
    expect(shearOnScreen / depthOnScreen).toBeCloseTo(SHEAR / SQUASH, 3);
  });
});

const names = ["full", ...subsets.map((layers) => layers.join("+") || "none")];

describe.each(names)("plates scene for layers %s (TST-022, AC-024)", (name) => {
  const scene = () => scenes.get(name)!;

  it("stacks the four plates from top to bottom and stands each concept on its own plate", () => {
    expectStacked(scene());
  });

  it("keeps concepts, plate marks and wire labels apart", () => {
    expectApart(scene());
  });

  it("routes no wire through a concept or a plate mark that is not one of its ends", () => {
    expectNoThroughWires(scene());
  });

  it("shares no line between two wires, in any orientation", () => {
    expectNoSharedLine(scene());
  });

  it("puts each wire label on its own wire: nearer to it than to any other wire, and touching no other wire", () => {
    expectLabelsOnOwnWire(scene());
  });

  it("starts each wire on its source's cell border and ends it on its target's, with no stub under 8 px", () => {
    expectWireEnds(scene());
  });

  it("keeps everything inside the scene bounds", () => {
    expectInsideBounds(scene());
  });
});

describe.each(names)("plates readability for layers %s (AC-1, AC-2, AC-4)", (name) => {
  const scene = () => scenes.get(name)!;

  it("AC-1: no wire lies along a plate edge for more than 35 px", () => {
    expectNoPlateEdgeRun(scene());
  });

  it("AC-1: wires drop straight off one plate edge, run along their own lane and drop straight onto the next", () => {
    expectDrops(scene(), layouts.get(name)!);
  });

  it("AC-2: a chip whose centre is in a gap sits on its own wire", () => {
    expectGapChips(scene());
  });

  it("AC-2: parallel wire segments that overlap for more than 20 px are at least 10 px apart", () => {
    expect(closeParallels(scene())).toEqual([]);
  });

  it("AC-4: no wire crosses a concept's label, other than at the cell border of its own ends", () => {
    expectNoLabelCrossing(scene());
  });
});

describe("shear (AC-3)", () => {
  it("is the largest step in [0.25, 0.5] that keeps TST-032 at Fit >= 0.85 in the free width of a 1366 px window and AC-2 in every scene", async () => {
    const layout = await layoutConcepts(byFileName(tst032Concepts));
    const fit = (shear: number) => fitScale(BOARD_WIDTH, buildScene(layout, shear).width);
    expect(SHEAR).toBeGreaterThanOrEqual(0.25);
    expect(SHEAR).toBeLessThanOrEqual(0.5);
    expect(fit(SHEAR)).toBeGreaterThanOrEqual(FIT_FLOOR);
    for (const [name, scene] of scenes) expect(closeParallels(scene), `parallels too close in ${name}`).toEqual([]);
    process.stdout.write(`shear ${SHEAR}: Fit ${fit(SHEAR).toFixed(3)}, next step ${(SHEAR + 0.05).toFixed(2)}: Fit ${fit(SHEAR + 0.05).toFixed(3)}
`);
    if (SHEAR + 0.05 <= 0.5 + 1e-9) expect(fit(SHEAR + 0.05)).toBeLessThan(FIT_FLOOR);
  });
});

describe("scene data (TST-022)", () => {
  it("keeps the wire's relation data for the popover", () => {
    const w = scenes.get("full")!.wires.find((x) => x.source === "host-prefix" && x.target === "secure-attr")!;
    expect(w.label).toBe("requires");
    expect(w.citation).toContain("rfc6265bis");
  });

  it("draws a wire for every relation whose two ends are shown", () => {
    expect(scenes.get("full")!.wires).toHaveLength(15);
    expect(scenes.get("client")!.wires).toHaveLength(
      tst032Concepts.filter((c) => c.layer === "client").flatMap((c) => c.relations.filter((r) => tst032Concepts.find((t) => t.id === r.to)!.layer === "client")).length,
    );
  });
});

describe("labels (TST-022)", () => {
  it("wraps a title on spaces and after hyphens into at most two lines", () => {
    expect(labelLines("C5", "upgrade-insecure-requests")).toEqual(["upgrade-", "insecure-requests"]);
    expect(labelLines("C1", "__Host- cookie prefix")).toEqual(["__Host- cookie", "prefix"]);
  });

  it("ends the second line with an ellipsis when the title does not fit", () => {
    const lines = labelLines("C1", "A very long concept title that keeps going and going");
    expect(lines).toHaveLength(2);
    expect(lines[1]!.endsWith("…")).toBe(true);
    expect(lines.every((l) => l.length <= 18)).toBe(true);
  });

  it("truncates a single word longer than the line", () => {
    expect(wrapText("supercalifragilisticexpialidocious", [10], 2)).toEqual(["supercali…"]);
  });
});

describe("pan and zoom view (TST-022, AC-027)", () => {
  const bounds: Box = { x0: 0, y0: 0, x1: 1000, y1: 600 };
  const free: Box = { x0: 100, y0: 50, x1: 1100, y1: 700 };

  it("sees the scene through a canvas-sized window that shrinks as the scale grows", () => {
    expect(viewFor({ width: 1200, height: 800 }, 1, { x: 10, y: 20 })).toEqual({ x: 10, y: 20, width: 1200, height: 800 });
    expect(viewFor({ width: 1200, height: 800 }, 2, { x: 10, y: 20 })).toEqual({ x: 10, y: 20, width: 600, height: 400 });
  });

  it("puts the scene's centre at the free area's centre and its top at the free area's top at Fit", () => {
    expect(homeOrigin(bounds, free, 1)).toEqual({ x: 500 - 600, y: -50 });
    expect(homeOrigin(bounds, free, 2)).toEqual({ x: 500 - 300, y: -25 });
  });

  it("lets the scene be dragged anywhere but never entirely out of the free area", () => {
    expect(clampOrigin(bounds, free, 1, { x: -50, y: 10 })).toEqual({ x: -50, y: 10 });
    const far = clampOrigin(bounds, free, 1, { x: 99999, y: -99999 });
    expect(far.x).toBe(1000 - (100 + 80));
    expect(far.y).toBe(0 - (700 - 80));
  });

  it("keeps the point under the pointer fixed while the scale changes", () => {
    const anchor = { x: 400, y: 300 };
    const origin = { x: 120, y: 40 };
    const next = zoomAround(origin, 1, 2, anchor);
    expect(origin.x + anchor.x / 1).toBeCloseTo(next.x + anchor.x / 2);
    expect(origin.y + anchor.y / 1).toBeCloseTo(next.y + anchor.y / 2);
  });

  it("moves the view only as far as needed to bring a box into the free area", () => {
    const origin = { x: 0, y: 0 };
    expect(revealBox(origin, 1, free, { x0: 300, y0: 100, x1: 400, y1: 160 })).toEqual(origin);
    expect(revealBox(origin, 1, free, { x0: 20, y0: 100, x1: 120, y1: 160 })).toEqual({ x: 20 - 100 - 12, y: 0 });
    expect(revealBox(origin, 1, free, { x0: 1000, y0: 100, x1: 1200, y1: 160 })).toEqual({ x: 1200 - 1100 + 12, y: 0 });
    expect(revealBox(origin, 1, free, { x0: 300, y0: 650, x1: 400, y1: 720 })).toEqual({ x: 0, y: 720 - 700 + 12 });
  });
});

describe("gap lanes on a hand-built layout (AC-1, AC-2)", () => {
  const node = (id: string, layer: Layer, y: number): PlateLayout["nodes"][number] => ({ id, designator: id, title: id, layer, pictogram: layer, x: 10, y, width: 60, height: 30 });
  const bands = LAYERS.map((layer, i) => ({ layer, top: i * 200, bottom: i * 200 + 100 }));
  // Each wire leaves the client band at x and enters the network band at x + 40; `run` is elk's own y for the horizontal run in the gap.
  const wire = (id: string, x: number, run: number | undefined, labelY: number): PlateLayout["edges"][number] => ({
    id,
    source: "a",
    target: "b",
    label: id,
    citation: "c",
    explanation: "e",
    route: run === undefined ? [{ x, y: 60 }, { x, y: 240 }] : [{ x, y: 60 }, { x, y: run }, { x: x + 40, y: run }, { x: x + 40, y: 240 }],
    labelBox: { x: x - 10, y: labelY - 5, width: 20, height: 10 },
  });
  const layout: PlateLayout = {
    width: 400,
    nodes: LAYERS.map((layer, i) => node(layer, layer, i * 200 + 20)),
    marks: LAYERS.map((layer, i) => node(`mark:${layer}`, layer, i * 200 + 60)),
    bands,
    edges: [wire("high", 100, 170, 170), wire("low", 200, 130, 130), wire("straight", 300, undefined, 150)],
    shown: { client: 1, network: 1, server: 1, data: 1 },
  };
  const scene = buildScene(layout);
  const byId = (id: string) => scene.wires.find((w) => w.id === id)!;
  const laneOf = (id: string) => {
    const path = byId(id).path;
    const i = path.findIndex((p, k) => k > 0 && Math.abs(p.y - path[k - 1]!.y) < 0.01 && Math.abs(p.x - path[k - 1]!.x) > 1);
    return path[i]!.y;
  };

  it("orders lanes by elk's run height and places a straight crossing by its own key between them", () => {
    expect(laneOf("low")).toBeLessThan(laneOf("straight"));
    expect(laneOf("straight")).toBeLessThan(laneOf("high"));
  });

  it("puts a chip whose centre is in the gap on its wire's lane", () => {
    for (const id of ["high", "low", "straight"]) expect(byId(id).chip.at.y, id).toBeCloseTo(laneOf(id), 5);
  });

  describe("a gap chip over another wire's drop", () => {
    const crowded = buildScene({
      ...layout,
      edges: [
        { ...wire("wide", 100, 150, 150), route: [{ x: 100, y: 60 }, { x: 100, y: 150 }, { x: 260, y: 150 }, { x: 260, y: 240 }], labelBox: { x: 170, y: 145, width: 20, height: 10 } },
        wire("cross", 180, undefined, 50),
      ],
    });
    const chip = crowded.wires.find((w) => w.id === "wide")!.chip;
    const cross = crowded.wires.find((w) => w.id === "cross")!;

    it("slides along its own lane until no other wire touches it", () => {
      const touches = cross.path.slice(1).some((b, i) => segmentHitsBox({ a: cross.path[i]!, b }, chip.box));
      expect(touches).toBe(false);
      const lane = crowded.wires.find((w) => w.id === "wide")!.path.filter((p, i, all) => i > 0 && Math.abs(p.y - all[i - 1]!.y) < 0.01 && Math.abs(p.x - all[i - 1]!.x) > 1);
      expect(chip.at.y).toBeCloseTo(lane[0]!.y, 5);
    });
  });

  describe("a gap chip with no clear spot on its lane", () => {
    // Drops of lower lanes cross the top lane every 30 px, closer together than the chip is wide, so only the open ground past the lane's end is clear.
    const narrow: PlateLayout["edges"][number] = {
      ...wire("narrow", 100, 120, 120),
      route: [{ x: 100, y: 60 }, { x: 100, y: 120 }, { x: 260, y: 120 }, { x: 260, y: 240 }],
      labelBox: { x: 170, y: 115, width: 20, height: 10 },
    };
    const drops = Array.from({ length: 7 }, (_, i) => wire(`drop${i}`, 125 + 30 * i, undefined, 150 + i));
    const scene = buildScene({ ...layout, edges: [narrow, ...drops] });
    const own = scene.wires.find((w) => w.id === "narrow")!;

    it("stays on its own lane instead of moving beyond the lane's run", () => {
      const lane = own.path.slice(1).map((b, i) => [own.path[i]!, b] as const).find(([a, b]) => Math.abs(a.y - b.y) < 0.01 && Math.abs(a.x - b.x) > 1)!;
      expect(own.chip.at.y).toBeCloseTo(lane[0].y, 5);
      expect(own.chip.at.x).toBeGreaterThanOrEqual(Math.min(lane[0].x, lane[1].x));
      expect(own.chip.at.x).toBeLessThanOrEqual(Math.max(lane[0].x, lane[1].x));
    });
  });
});
