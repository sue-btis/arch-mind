import { beforeAll, describe, expect, it } from "vitest";
import { LAYERS, type Concept, type Layer } from "@arch-mind/rules/model";
import { overWideConcepts, tst032Concepts } from "@arch-mind/rules/fixtures";
import { layoutConcepts, type PlateLayout, type Point } from "../src/layout.ts";
import {
  FIT_FLOOR,
  SHEAR,
  SQUASH,
  buildScene,
  clampOrigin,
  distanceToPath,
  fitScale,
  homeOrigin,
  isRefused,
  labelLines,
  revealBox,
  segmentHitsBox,
  sharesLane,
  viewFor,
  wrapText,
  zoomAround,
  type Box,
  type Scene,
} from "../src/plates.ts";

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

const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

// Pairs of wire segments that run parallel and overlap for more than 20 px yet sit under 10 px apart.
function closeParallels(s: Scene): string[] {
  const segments = s.wires.flatMap((w) => w.path.slice(1).map((b, i) => ({ id: w.id, a: w.path[i]!, b })));
  const unit = (seg: { a: Point; b: Point }) => {
    const len = Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y);
    return { x: (seg.b.x - seg.a.x) / len, y: (seg.b.y - seg.a.y) / len, len };
  };
  const found: string[] = [];
  for (const [i, one] of segments.entries()) {
    for (const two of segments.slice(i + 1)) {
      if (one.id === two.id) continue;
      const d1 = unit(one);
      const d2 = unit(two);
      if (d1.len < 1 || d2.len < 1 || Math.abs(d1.x * d2.y - d1.y * d2.x) > 0.05) continue;
      const along = (p: Point) => (p.x - one.a.x) * d1.x + (p.y - one.a.y) * d1.y;
      const across = (p: Point) => Math.abs((p.x - one.a.x) * d1.y - (p.y - one.a.y) * d1.x);
      const overlap = Math.min(d1.len, Math.max(along(two.a), along(two.b))) - Math.max(0, Math.min(along(two.a), along(two.b)));
      if (overlap > 20 && Math.min(across(two.a), across(two.b)) < 10) found.push(`${one.id} and ${two.id}`);
    }
  }
  return found;
}

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

describe.each(names)("plates readability for layers %s (AC-1, AC-2, AC-4)", (name) => {
  const scene = () => scenes.get(name)!;
  const segmentsOf = (s: Scene) => s.wires.flatMap((w) => w.path.slice(1).map((b, i) => ({ id: w.id, a: w.path[i]!, b })));

  it("AC-1: no wire lies along a plate edge for more than 35 px", () => {
    const s = scene();
    const edges = s.plates.flatMap((p) => [
      [p.corners[0]!, p.corners[1]!],
      [p.corners[3]!, p.corners[2]!],
    ]);
    const near = (p: Point) => edges.some(([a, b]) => distanceToPath(p, [a!, b!]) <= 3);
    for (const seg of segmentsOf(s)) {
      const length = Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y);
      const steps = Math.max(1, Math.ceil(length));
      let lying = 0;
      for (let i = 0; i < steps; i++) {
        const t = (i + 0.5) / steps;
        if (near({ x: seg.a.x + (seg.b.x - seg.a.x) * t, y: seg.a.y + (seg.b.y - seg.a.y) * t })) lying += length / steps;
      }
      expect(lying, `${seg.id} lies along a plate edge`).toBeLessThanOrEqual(35);
    }
  });

  it("AC-1: wires drop straight off one plate edge, run along their own lane and drop straight onto the next", () => {
    const s = scene();
    const layout = layouts.get(name)!;
    const layerOf = new Map(s.objects.map((o) => [o.id, LAYERS.indexOf(o.layer)]));
    const crossing = (gap: number) =>
      s.wires.filter((w) => Math.min(layerOf.get(w.source)!, layerOf.get(w.target)!) <= gap && Math.max(layerOf.get(w.source)!, layerOf.get(w.target)!) > gap);
    for (let gap = 0; gap < s.plates.length - 1; gap++) {
      const front = Math.max(...s.plates[gap]!.corners.map((c) => c.y));
      const back = Math.min(...s.plates[gap + 1]!.corners.map((c) => c.y));
      const wiresHere = crossing(gap);
      expect(back - front, `gap below ${s.plates[gap]!.layer}`).toBeCloseTo(Math.max(64, 2 * 20 + (wiresHere.length - 1) * 12), 3);
      const lanes: { id: string; y: number; key: number }[] = [];
      for (const w of wiresHere) {
        const inside = (p: Point) => p.y >= front - 0.5 && p.y <= back + 0.5;
        const first = w.path.findIndex(inside);
        let last = first;
        while (last + 1 < w.path.length && inside(w.path[last + 1]!)) last++;
        const dive = w.path.slice(first, last + 1);
        const ys = dive.map((p) => p.y);
        expect([Math.min(...ys), Math.max(...ys)].map(Math.round), `${w.id} spans the gap`).toEqual([Math.round(front), Math.round(back)]);
        const horizontals = dive.slice(1).flatMap((b, i) => {
          const a = dive[i]!;
          const vertical = Math.abs(a.x - b.x) <= 0.5;
          const horizontal = Math.abs(a.y - b.y) <= 0.5;
          expect(vertical || horizontal, `${w.id} has a slanted segment inside the gap`).toBe(true);
          return horizontal && !vertical ? [a.y] : [];
        });
        expect(horizontals.length, `${w.id} has more than one lane`).toBeLessThanOrEqual(1);
        if (Math.abs(dive[0]!.x - dive[dive.length - 1]!.x) > 0.5) expect(horizontals, `${w.id} has no lane`).toHaveLength(1);
        const elk = layout.edges.find((e) => e.id === w.id)!.route;
        const run = elk.slice(1).find((b, i) => Math.abs(b.y - elk[i]!.y) < 0.01 && b.y > layout.bands[gap]!.bottom && b.y < layout.bands[gap + 1]!.top);
        if (horizontals.length === 1) lanes.push({ id: w.id, y: horizontals[0]!, key: run?.y ?? 0 });
      }
      const byLane = [...lanes].sort((a, b) => a.y - b.y);
      for (let i = 1; i < byLane.length; i++) expect(byLane[i]!.y - byLane[i - 1]!.y, `lanes of ${byLane[i]!.id} and ${byLane[i - 1]!.id}`).toBeGreaterThanOrEqual(10);
      const byElk = [...lanes].sort((a, b) => a.key - b.key);
      expect(byLane.map((l) => l.key), `lanes below ${s.plates[gap]!.layer} keep elk's order`).toEqual(byElk.map((l) => l.key));
    }
  });

  it("AC-2: a chip whose centre is in a gap sits on its own wire", () => {
    const s = scene();
    for (const w of s.wires) {
      const inGap = s.plates.slice(1).some((p, i) => w.chip.at.y > Math.max(...s.plates[i]!.corners.map((c) => c.y)) && w.chip.at.y < Math.min(...p.corners.map((c) => c.y)));
      if (inGap) expect(distanceToPath(w.chip.at, w.path), `${w.id} chip`).toBeLessThan(0.5);
    }
  });

  it("AC-2: parallel wire segments that overlap for more than 20 px are at least 10 px apart", () => {
    expect(closeParallels(scene())).toEqual([]);
  });

  it("AC-4: no wire crosses a concept's label, other than at the cell border of its own ends", () => {
    const s = scene();
    for (const w of s.wires) {
      for (const o of [...s.objects, ...s.plates.map((p) => p.mark)]) {
        const label = o.parts[1]!;
        w.path.slice(1).forEach((b, i) => {
          const own = (o.id === w.source && i === 0) || (o.id === w.target && i === w.path.length - 2);
          if (own) return;
          expect(segmentHitsBox({ a: w.path[i]!, b }, label), `${w.id} crosses the label of ${o.id}`).toBe(false);
        });
      }
    }
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
});
