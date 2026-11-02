import { expect } from "vitest";
import { LAYERS } from "@arch-mind/rules/model";
import type { PlateLayout, Point } from "../src/layout.ts";
import { distanceToPath, segmentHitsBox, sharesLane, type Box, type Scene } from "../src/plates.ts";

// Scene invariants of the Board Grid Rule, shared by the flat and the grouped scene tests.
export const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

// Pairs of wire segments that run parallel and overlap for more than 20 px yet sit under 10 px apart.
export function closeParallels(s: Scene): string[] {
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


export function expectStacked(s: Scene): void {
  expect(s.plates.map((p) => p.layer)).toEqual([...LAYERS]);
  for (let i = 1; i < s.plates.length; i++) {
    expect(Math.min(...s.plates[i]!.corners.map((c) => c.y))).toBeGreaterThan(Math.max(...s.plates[i - 1]!.corners.map((c) => c.y)));
  }
  for (const o of s.objects) {
    const ys = s.plates.find((p) => p.layer === o.layer)!.corners.map((c) => c.y);
    expect(o.at.y, o.id).toBeGreaterThan(Math.min(...ys));
    expect(o.at.y, o.id).toBeLessThan(Math.max(...ys));
  }
}

export function expectApart(s: Scene): void {
  const things = [...s.objects, ...s.plates.map((p) => p.mark)];
  for (const [i, a] of things.entries()) {
    for (const b of things.slice(i + 1)) {
      for (const pa of a.parts) for (const pb of b.parts) expect(overlaps(pa, pb), `${a.id} and ${b.id}`).toBe(false);
    }
  }
  for (const w of s.wires) {
    for (const o of things) for (const part of o.parts) expect(overlaps(w.chip.box, part), `${w.label} (${w.id}) over ${o.id}`).toBe(false);
  }
}

export function expectNoThroughWires(s: Scene): void {
  const marks = s.plates.map((p) => p.mark);
  for (const w of s.wires) {
    for (const o of [...s.objects.filter((x) => x.id !== w.source && x.id !== w.target), ...marks]) {
      const crossed = w.path.slice(1).some((b, i) => o.parts.some((part) => segmentHitsBox({ a: w.path[i]!, b }, part)));
      expect(crossed, `${w.label} ${w.source}>${w.target} crosses ${o.id}`).toBe(false);
    }
  }
}

export function expectNoSharedLine(s: Scene): void {
  const segments = s.wires.flatMap((w) => w.path.slice(1).map((b, i) => ({ id: w.id, a: w.path[i]!, b })));
  for (const [i, one] of segments.entries()) {
    for (const two of segments.slice(i + 1)) {
      if (one.id !== two.id) expect(sharesLane(one, two), `${one.id} and ${two.id} run along the same line`).toBe(false);
    }
  }
}

export function expectLabelsOnOwnWire(s: Scene): void {
  for (const w of s.wires) {
    const own = distanceToPath(w.chip.at, w.path);
    for (const other of s.wires.filter((x) => x.id !== w.id)) {
      expect(own, `${w.label} (${w.id}) is nearer ${other.id}`).toBeLessThan(distanceToPath(w.chip.at, other.path));
      const touches = other.path.slice(1).some((b, i) => segmentHitsBox({ a: other.path[i]!, b }, w.chip.box));
      expect(touches, `${w.label} (${w.id}) covers a segment of ${other.id}`).toBe(false);
    }
  }
}

export function expectWireEnds(s: Scene): void {
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
}

export function expectInsideBounds(s: Scene): void {
  const inside = (b: Box) => b.x0 >= s.bounds.x0 && b.x1 <= s.bounds.x1 && b.y0 >= s.bounds.y0 && b.y1 <= s.bounds.y1;
  for (const o of s.objects) expect(inside(o.box), o.id).toBe(true);
  for (const w of s.wires) expect(inside(w.chip.box), w.id).toBe(true);
  expect(s.width).toBeCloseTo(s.bounds.x1 - s.bounds.x0);
}

const segmentsOf = (s: Scene) => s.wires.flatMap((w) => w.path.slice(1).map((b, i) => ({ id: w.id, a: w.path[i]!, b })));

export function expectNoPlateEdgeRun(s: Scene): void {
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
}

export function expectDrops(s: Scene, layout: PlateLayout): void {
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
}

export function expectGapChips(s: Scene): void {
  for (const w of s.wires) {
    const inGap = s.plates.slice(1).some((p, i) => w.chip.at.y > Math.max(...s.plates[i]!.corners.map((c) => c.y)) && w.chip.at.y < Math.min(...p.corners.map((c) => c.y)));
    if (inGap) expect(distanceToPath(w.chip.at, w.path), `${w.id} chip`).toBeLessThan(0.5);
  }
}

export function expectNoLabelCrossing(s: Scene): void {
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
}

export function expectSceneInvariants(scene: Scene, layout: PlateLayout): void {
  expectStacked(scene);
  expectApart(scene);
  expectNoThroughWires(scene);
  expectNoSharedLine(scene);
  expectLabelsOnOwnWire(scene);
  expectWireEnds(scene);
  expectInsideBounds(scene);
  expectNoPlateEdgeRun(scene);
  expectDrops(scene, layout);
  expectGapChips(scene);
  expectNoLabelCrossing(scene);
  expect(closeParallels(scene)).toEqual([]);
}
