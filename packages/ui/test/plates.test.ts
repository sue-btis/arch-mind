import { beforeAll, describe, expect, it } from "vitest";
import { LAYERS, type Concept, type Layer } from "@arch-mind/rules/model";
import { overWideConcepts, tst032Concepts } from "@arch-mind/rules/fixtures";
import { layoutConcepts } from "../src/layout.ts";
import {
  FIT_FLOOR,
  SHEAR,
  SQUASH,
  buildScene,
  centreOf,
  distanceToPath,
  fitScale,
  followBox,
  isRefused,
  labelLines,
  segmentHitsBox,
  sharesLane,
  viewFor,
  wrapText,
  type Box,
  type Scene,
} from "../src/plates.ts";

const BOARD_WIDTH = 1100;

// The server lists concept files in name order, so the plates are drawn from the same order here.
const byFileName = (concepts: Concept[]) => [...concepts].sort((a, b) => `${a.id}.md`.localeCompare(`${b.id}.md`));
const draw = async (concepts: Concept[]) => buildScene(await layoutConcepts(byFileName(concepts)));

const subsets: Layer[][] = Array.from({ length: 16 }, (_, mask) => LAYERS.filter((_layer, i) => mask & (1 << i)));
const only = (layers: Layer[]) => (layers.length === 0 ? [] : tst032Concepts.filter((c) => layers.includes(c.layer)));
const scenes = new Map<string, Scene>();
let timing = 0;

beforeAll(async () => {
  const started = performance.now();
  scenes.set("full", await draw(tst032Concepts));
  timing = performance.now() - started;
  for (const layers of subsets) scenes.set(layers.join("+") || "none", await draw(only(layers)));
  process.stdout.write(`TST-032 layout and projection: ${Math.round(timing)} ms\n`);
});

const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

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
    const s = scene();
    expect(s.plates.map((p) => p.layer)).toEqual([...LAYERS]);
    for (let i = 1; i < s.plates.length; i++) {
      expect(Math.min(...s.plates[i]!.corners.map((c) => c.y))).toBeGreaterThan(Math.max(...s.plates[i - 1]!.corners.map((c) => c.y)));
    }
    for (const o of s.objects) {
      const ys = s.plates.find((p) => p.layer === o.layer)!.corners.map((c) => c.y);
      expect(o.at.y, o.id).toBeGreaterThan(Math.min(...ys));
      expect(o.at.y, o.id).toBeLessThan(Math.max(...ys));
    }
  });

  it("keeps concepts, plate marks and wire labels apart", () => {
    const s = scene();
    const things = [...s.objects, ...s.plates.map((p) => p.mark)];
    for (const [i, a] of things.entries()) {
      for (const b of things.slice(i + 1)) {
        for (const pa of a.parts) for (const pb of b.parts) expect(overlaps(pa, pb), `${a.id} and ${b.id}`).toBe(false);
      }
    }
    for (const w of s.wires) {
      for (const o of things) for (const part of o.parts) expect(overlaps(w.chip.box, part), `${w.label} (${w.id}) over ${o.id}`).toBe(false);
    }
  });

  it("routes no wire through a concept or a plate mark that is not one of its ends", () => {
    const s = scene();
    const marks = s.plates.map((p) => p.mark);
    for (const w of s.wires) {
      for (const o of [...s.objects.filter((x) => x.id !== w.source && x.id !== w.target), ...marks]) {
        const crossed = w.path.slice(1).some((b, i) => o.parts.some((part) => segmentHitsBox({ a: w.path[i]!, b }, part)));
        expect(crossed, `${w.label} ${w.source}>${w.target} crosses ${o.id}`).toBe(false);
      }
    }
  });

  it("shares no line between two wires, in any orientation", () => {
    const s = scene();
    const segments = s.wires.flatMap((w) => w.path.slice(1).map((b, i) => ({ id: w.id, a: w.path[i]!, b })));
    for (const [i, one] of segments.entries()) {
      for (const two of segments.slice(i + 1)) {
        if (one.id !== two.id) expect(sharesLane(one, two), `${one.id} and ${two.id} run along the same line`).toBe(false);
      }
    }
  });

  it("puts each wire label on its own wire: nearer to it than to any other wire, and touching no other wire", () => {
    const s = scene();
    for (const w of s.wires) {
      const own = distanceToPath(w.chip.at, w.path);
      for (const other of s.wires.filter((x) => x.id !== w.id)) {
        expect(own, `${w.label} (${w.id}) is nearer ${other.id}`).toBeLessThan(distanceToPath(w.chip.at, other.path));
        const touches = other.path.slice(1).some((b, i) => segmentHitsBox({ a: other.path[i]!, b }, w.chip.box));
        expect(touches, `${w.label} (${w.id}) covers a segment of ${other.id}`).toBe(false);
      }
    }
  });

  it("starts each wire on its source's cell border and ends it on its target's, with no stub under 8 px", () => {
    const s = scene();
    const at = new Map(s.objects.map((o) => [o.id, o]));
    const onTopOrBottom = (p: { x: number; y: number }, cell: { x: number; y: number }[]) =>
      Math.min(distanceToPath(p, [cell[0]!, cell[1]!]), distanceToPath(p, [cell[3]!, cell[2]!]));
    for (const w of s.wires) {
      const first = w.path[0]!;
      const last = w.path[w.path.length - 1]!;
      expect(onTopOrBottom(first, at.get(w.source)!.cell), `${w.id} start`).toBeLessThan(1);
      expect(onTopOrBottom(last, at.get(w.target)!.cell), `${w.id} end`).toBeLessThan(1);
      const lengths = w.path.slice(1).map((p, i) => Math.hypot(p.x - w.path[i]!.x, p.y - w.path[i]!.y));
      expect(Math.min(...lengths), `${w.label} (${w.id}) has a stub`).toBeGreaterThanOrEqual(8);
    }
  });

  it("keeps everything inside the scene bounds", () => {
    const s = scene();
    const inside = (b: Box) => b.x0 >= s.bounds.x0 && b.x1 <= s.bounds.x1 && b.y0 >= s.bounds.y0 && b.y1 <= s.bounds.y1;
    for (const o of s.objects) expect(inside(o.box), o.id).toBe(true);
    for (const w of s.wires) expect(inside(w.chip.box), w.id).toBe(true);
    expect(s.width).toBeCloseTo(s.bounds.x1 - s.bounds.x0);
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

describe("zoom view (TST-022, AC-027)", () => {
  const bounds: Box = { x0: 0, y0: 0, x1: 1000, y1: 600 };

  it("shows the whole scene at Fit and a smaller window when zoomed in", () => {
    expect(viewFor(bounds, 1, centreOf(bounds))).toEqual({ x: 0, y: 0, width: 1000, height: 600 });
    expect(viewFor(bounds, 2, centreOf(bounds))).toEqual({ x: 250, y: 150, width: 500, height: 300 });
  });

  it("keeps the zoomed window inside the scene", () => {
    expect(viewFor(bounds, 2, { x: -500, y: 5000 })).toEqual({ x: 0, y: 300, width: 500, height: 300 });
  });

  it("moves the window only as far as needed to bring a focused box into view", () => {
    const view = viewFor(bounds, 2, centreOf(bounds));
    expect(followBox(view, { x0: 300, y0: 200, x1: 400, y1: 260 })).toEqual({ x: 500, y: 300 });
    expect(followBox(view, { x0: 100, y0: 200, x1: 200, y1: 260 })).toEqual({ x: 350, y: 300 });
    expect(followBox(view, { x0: 700, y0: 200, x1: 800, y1: 260 })).toEqual({ x: 550, y: 300 });
    expect(followBox(view, { x0: 300, y0: 20, x1: 400, y1: 60 })).toEqual({ x: 500, y: 170 });
  });
});
