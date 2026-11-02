import { LAYERS, type Layer } from "@arch-mind/rules/model";
import type { PlateBand, PlateLayout, PlateNode, Point } from "./layout.ts";
import {
  FIT_FLOOR,
  GROUND,
  GROUND_FRACTION,
  LABEL_OFFSET,
  LINE_HEIGHT,
  PICTOGRAM_PX,
  SHEAR,
  SQUASH,
  chipLines,
  chipSize,
  labelLines,
  textWidth,
} from "./metrics.ts";

export { FIT_FLOOR, GROUND, LABEL_OFFSET, LABEL_PX, LINE_HEIGHT, PICTOGRAM_PX, SHEAR, SQUASH, labelLines, wrapText } from "./metrics.ts";

const SCENE_MARGIN = 12;
const MIN_SEGMENT = 9;
// Two drops through one gap closer than this read as one wire (the Board Grid Rule checks 10 px).
const MIN_DROP_APART = 12;
const NUDGE_REACH = 40;

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Chip {
  at: Point;
  lines: string[];
  box: Box;
}

export interface SceneObject {
  id: string;
  designator: string;
  title: string;
  layer: Layer;
  pictogram: string;
  at: Point;
  lines: string[];
  // The pictogram and the label as drawn upright, and the sheared cell elk reserved for them.
  parts: Box[];
  box: Box;
  cell: Point[];
}

export interface ScenePlate {
  layer: Layer;
  corners: Point[];
  mark: SceneObject;
  shown: number;
  emptyAt: Point;
}

export interface SceneWire {
  id: string;
  source: string;
  target: string;
  label: string;
  type: string | null;
  citation: string;
  explanation: string;
  path: Point[];
  chip: Chip;
}

export interface Scene {
  plates: ScenePlate[];
  objects: SceneObject[];
  wires: SceneWire[];
  bounds: Box;
  width: number;
  height: number;
}

export function fitScale(boardWidth: number, projectedWidth: number): number {
  return projectedWidth <= 0 ? 1 : Math.min(1, boardWidth / projectedWidth);
}

export function isRefused(scale: number): boolean {
  return scale < FIT_FLOOR;
}

export function segmentHitsBox({ a, b }: { a: Point; b: Point }, box: Box): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  for (const [p, q] of [
    [-dx, a.x - box.x0],
    [dx, box.x1 - a.x],
    [-dy, a.y - box.y0],
    [dy, box.y1 - a.y],
  ] as const) {
    if (p === 0) {
      if (q < 0) return false;
    } else {
      const r = q / p;
      if (p < 0) t0 = Math.max(t0, r);
      else t1 = Math.min(t1, r);
    }
  }
  return t0 <= t1;
}

export function distanceToPath(p: Point, path: Point[]): number {
  return Math.min(
    ...path.slice(1).map((b, i) => {
      const a = path[i]!;
      const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
      const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / len2));
      return Math.hypot(p.x - (a.x + t * (b.x - a.x)), p.y - (a.y + t * (b.y - a.y)));
    }),
  );
}

// Parallel segments within a few px of one line that share some length read as one wire; crossings do not count.
export function sharesLane(s1: { a: Point; b: Point }, s2: { a: Point; b: Point }, tolerance = 3): boolean {
  const length = Math.hypot(s1.b.x - s1.a.x, s1.b.y - s1.a.y);
  if (length < 1) return false;
  const d = { x: (s1.b.x - s1.a.x) / length, y: (s1.b.y - s1.a.y) / length };
  const along = (p: Point) => (p.x - s1.a.x) * d.x + (p.y - s1.a.y) * d.y;
  const across = (p: Point) => Math.abs((p.x - s1.a.x) * d.y - (p.y - s1.a.y) * d.x);
  if (across(s2.a) > tolerance || across(s2.b) > tolerance) return false;
  const lo = Math.min(along(s2.a), along(s2.b));
  const hi = Math.max(along(s2.a), along(s2.b));
  return Math.min(length, hi) - Math.max(0, lo) > 1;
}

interface LaneRun {
  y: number;
  x0: number;
  x1: number;
}

// A chip in a gap sits on its own lane; when its midpoint lies on another wire's drop it slides along the lane to the nearest clear spot.
function slideChip(wire: SceneWire, run: LaneRun, wires: SceneWire[]): void {
  const others = wires.filter((o) => o.id !== wire.id);
  const size = { width: wire.chip.box.x1 - wire.chip.box.x0, height: wire.chip.box.y1 - wire.chip.box.y0 };
  const clearAt = (x: number) => {
    const box = boxAround({ x, y: run.y }, size.width, size.height);
    return !others.some((o) => o.path.slice(1).some((b, i) => segmentHitsBox({ a: o.path[i]!, b }, box)));
  };
  const mid = wire.chip.at.x;
  for (let d = 0; d <= run.x1 - run.x0; d++) {
    for (const x of d === 0 ? [mid] : [mid - d, mid + d]) {
      if (x < run.x0 || x > run.x1 || !clearAt(x)) continue;
      wire.chip = { ...wire.chip, at: { x, y: run.y }, box: boxAround({ x, y: run.y }, size.width, size.height) };
      return;
    }
  }
}

const LANE = 12;
const LANE_PAD = 20;
const MIN_GAP = 64;
const EPS = 0.5;
// Elk-plane units added to each band: with layout's own padding alone a wire's first drop off the plate edge is a stub under 8 px.
const EDGE_PAD = 4;

type Place = { band: number } | { gap: number };

function locate(bands: PlateBand[], y: number): Place {
  for (const [i, b] of bands.entries()) {
    if (y >= b.top - EPS && y <= b.bottom + EPS) return { band: i };
    const next = bands[i + 1];
    if (next && y > b.bottom + EPS && y < next.top - EPS) return { gap: i };
  }
  return { band: y < bands[0]!.top ? 0 : bands.length - 1 };
}

// A wire's visit to the room between two plates: it leaves one band at `from` and re-enters at `to`.
interface Dive {
  gap: number;
  from: Point;
  to: Point;
  fromBand: number;
  toBand: number;
  // elk's own height for the wire's horizontal run in the gap; it orders the lanes.
  key: number;
  lane: number;
}

type Piece = { at: Point; band: number } | Dive;

// One wire's visit to a gap as the points it was drawn with: leave `a`, lane ends `b` and `c`, enter `d`.
interface Visit {
  gap: number;
  path: Point[];
  a: Point;
  b: Point;
  c: Point;
  d: Point;
}

interface Drop {
  visit: Visit;
  points: Point[];
  // The other end of the lane run, when this drop is not the whole straight line.
  partner?: Point;
  // Each plate-edge point with the path point next to it and the shortest that segment may become.
  ends: { at: Point; next: Point; floor: number }[];
}

// The shear moves a drop off the lower edge of a band by the band's height but not a drop onto the next band's top edge,
// so two unrelated drops through one gap, or the two ends of one lane, can land a few px apart. Drops slide sideways, together
// with their lane end, to the nearest x where they are clear of each other and leave no stub, so elk's vertical runs keep their order.
function separateDrops(visits: Visit[]): void {
  const drops = visits.flatMap((visit): Drop[] => {
    const { path, a, b, c, d } = visit;
    const end = (at: Point, next: Point | undefined) => (next ? [{ at, next, floor: Math.min(Math.hypot(at.x - next.x, at.y - next.y), 8.5) }] : []);
    const before = path[path.indexOf(a) - 1];
    const after = path[path.indexOf(d) + 1];
    if (b === c) return [{ visit, points: [a, b, d], ends: [...end(a, before), ...end(d, after)] }];
    return [
      { visit, points: [a, b], partner: c, ends: end(a, before) },
      { visit, points: [c, d], partner: b, ends: end(d, after) },
    ];
  });
  const span = (drop: Drop) => [Math.min(...drop.points.map((p) => p.y)), Math.max(...drop.points.map((p) => p.y))] as const;
  const clearAt = (drop: Drop, x: number) => {
    const [lo, hi] = span(drop);
    const run = drop.partner ? Math.abs(x - drop.partner.x) : 0;
    return (
      (run === 0 || run >= MIN_SEGMENT) &&
      drop.ends.every((e) => Math.hypot(x - e.next.x, e.at.y - e.next.y) >= e.floor) &&
      drops.every((o) => {
        if (o.visit === drop.visit || o.visit.gap !== drop.visit.gap) return true;
        const [olo, ohi] = span(o);
        return Math.min(hi, ohi) - Math.max(lo, olo) <= 0 || Math.abs(x - o.points[0]!.x) >= MIN_DROP_APART;
      })
    );
  };
  for (let pass = 0; pass < 8; pass++) {
    let moved = false;
    for (const drop of drops) {
      const x0 = drop.points[0]!.x;
      if (clearAt(drop, x0)) continue;
      const reach = Array.from({ length: 2 * NUDGE_REACH }, (_, i) => x0 + (i % 2 ? -1 : 1) * (Math.floor(i / 2) + 1));
      const best = [...(drop.partner ? [drop.partner.x] : []), ...reach].sort((p, q) => Math.abs(p - x0) - Math.abs(q - x0)).find((x) => clearAt(drop, x));
      if (best === undefined) continue;
      for (const p of drop.points) p.x = best;
      moved = true;
    }
    if (!moved) return;
  }
}

// A vertical run that crosses a band edge gets a point there, so every gap visit starts and ends on a plate edge.
function densify(bands: PlateBand[], route: Point[]): Point[] {
  const edges = bands.flatMap((b) => [b.top, b.bottom]);
  const out = [route[0]!];
  for (const b of route.slice(1)) {
    const a = out[out.length - 1]!;
    if (Math.abs(a.x - b.x) < 0.01) {
      const crossed = edges.filter((y) => y > Math.min(a.y, b.y) + EPS && y < Math.max(a.y, b.y) - EPS).sort((p, q) => (b.y > a.y ? p - q : q - p));
      for (const y of crossed) out.push({ x: a.x, y });
    }
    out.push(b);
  }
  return out;
}

function piecesOf(bands: PlateBand[], route: Point[]): Piece[] {
  const pts = densify(bands, route);
  const out: Piece[] = [];
  const bandOf = (p: Point) => (locate(bands, p.y) as { band: number }).band;
  for (let i = 0; i < pts.length; ) {
    const here = locate(bands, pts[i]!.y);
    if ("gap" in here) {
      let k = i;
      while (k < pts.length && "gap" in locate(bands, pts[k]!.y)) k++;
      const inner = pts.slice(i, k);
      const run = inner.find((p, j) => j > 0 && Math.abs(p.y - inner[j - 1]!.y) < 0.01);
      const from = pts[i - 1]!;
      const to = pts[k]!;
      out.push({ gap: here.gap, from, to, fromBand: bandOf(from), toBand: bandOf(to), key: (run ?? inner[0]!).y, lane: 0 });
      i = k;
      continue;
    }
    const previous = pts[i - 1];
    const last = out[out.length - 1];
    if (previous && last && "at" in last && last.band !== here.band && Math.abs(previous.x - pts[i]!.x) < 0.01) {
      const gap = Math.min(last.band, here.band);
      out.push({ gap, from: previous, to: pts[i]!, fromBand: last.band, toBand: here.band, key: (bands[gap]!.bottom + bands[gap + 1]!.top) / 2, lane: 0 });
    }
    out.push({ at: pts[i]!, band: here.band });
    i++;
  }
  return out;
}

function boxAround(at: Point, width: number, height: number): Box {
  return { x0: at.x - width / 2, y0: at.y - height / 2, x1: at.x + width / 2, y1: at.y + height / 2 };
}

export function union(boxes: Box[]): Box {
  return {
    x0: Math.min(...boxes.map((b) => b.x0)),
    y0: Math.min(...boxes.map((b) => b.y0)),
    x1: Math.max(...boxes.map((b) => b.x1)),
    y1: Math.max(...boxes.map((b) => b.y1)),
  };
}

function sceneObject(n: PlateNode, onPlate: (p: Point) => Point, caption?: string): SceneObject {
  const ground = n.y + GROUND_FRACTION * n.height;
  const at = onPlate({ x: n.x + n.width / 2, y: ground });
  const lines = caption === undefined ? labelLines(n.designator, n.title) : [caption];
  const widest = Math.max(...lines.map((line, i) => textWidth(i === 0 && caption === undefined ? `${n.designator} ${line}` : line)));
  const pictogram: Box = { x0: at.x - PICTOGRAM_PX / 2, y0: at.y - GROUND.y, x1: at.x + PICTOGRAM_PX / 2, y1: at.y - GROUND.y + PICTOGRAM_PX };
  const label: Box = { x0: at.x - widest / 2, y0: at.y + LABEL_OFFSET, x1: at.x + widest / 2, y1: at.y + LABEL_OFFSET + lines.length * LINE_HEIGHT };
  const cell = [
    { x: n.x, y: n.y },
    { x: n.x + n.width, y: n.y },
    { x: n.x + n.width, y: n.y + n.height },
    { x: n.x, y: n.y + n.height },
  ].map(onPlate);
  return {
    id: n.id,
    designator: n.designator,
    title: n.title,
    layer: n.layer,
    pictogram: n.pictogram,
    at,
    lines,
    parts: [pictogram, label],
    box: union([pictogram, label]),
    cell,
  };
}

export function buildScene(layout: PlateLayout, shear = SHEAR): Scene {
  return projectScene(layout, shear).scene;
}

// `onPlate(band)` maps a band point onto the plate, so a caller can project extra shapes through the same mapping.
export function projectScene(layout: PlateLayout, shear = SHEAR): { scene: Scene; onPlate: (band: number) => (p: Point) => Point } {
  const bands = layout.bands.map((b) => ({ ...b, top: b.top - EDGE_PAD, bottom: b.bottom + EDGE_PAD }));
  const routes = layout.edges.map((e) => piecesOf(bands, e.route));
  const dives: Dive[][] = bands.slice(0, -1).map(() => []);
  for (const piece of routes.flat()) if ("gap" in piece) dives[piece.gap]!.push(piece);
  for (const list of dives) list.sort((a, b) => a.key - b.key).forEach((dive, lane) => (dive.lane = lane));

  const starts = [0];
  const gapHeights = dives.map((list) => Math.max(MIN_GAP, 2 * LANE_PAD + (list.length - 1) * LANE));
  bands.slice(0, -1).forEach((b, i) => starts.push(starts[i]! + SQUASH * (b.bottom - b.top) + gapHeights[i]!));
  const onPlate = (band: number) => (p: Point) => ({ x: p.x - shear * (p.y - bands[band]!.top), y: starts[band]! + SQUASH * (p.y - bands[band]!.top) });
  const laneY = (gap: number, lane: number) => starts[gap]! + SQUASH * (bands[gap]!.bottom - bands[gap]!.top) + LANE_PAD + lane * LANE;

  const objects = layout.nodes.map((n) => sceneObject(n, onPlate(LAYERS.indexOf(n.layer))));

  const plates: ScenePlate[] = LAYERS.map((layer, i) => {
    const band = bands[i]!;
    const at = onPlate(i);
    const corners = [
      { x: 0, y: band.top },
      { x: layout.width, y: band.top },
      { x: layout.width, y: band.bottom },
      { x: 0, y: band.bottom },
    ].map(at);
    return {
      layer,
      corners,
      mark: sceneObject(layout.marks[i]!, at, `${layer.toUpperCase()} ${layout.shown[layer]} shown`),
      shown: layout.shown[layer],
      emptyAt: at({ x: layout.width * 0.75, y: (band.top + band.bottom) / 2 }),
    };
  });

  const drafts = layout.edges.map((e, w) => {
    const path: Point[] = [];
    const anchors = new Set<Point>();
    const visits: Visit[] = [];
    const push = (p: Point, anchor = false) => {
      const last = path[path.length - 1];
      if (last && Math.abs(last.x - p.x) < 0.01 && Math.abs(last.y - p.y) < 0.01) {
        if (anchor) anchors.add(last);
        return last;
      }
      path.push(p);
      if (anchor) anchors.add(p);
      return p;
    };
    for (const piece of routes[w]!) {
      if ("at" in piece) {
        push(onPlate(piece.band)(piece.at));
        continue;
      }
      // The wire drops straight off one plate edge, runs along its own lane and drops straight onto the next.
      const leave = onPlate(piece.fromBand)({ x: piece.from.x, y: piece.fromBand === piece.gap ? bands[piece.fromBand]!.bottom : bands[piece.fromBand]!.top });
      const enter = onPlate(piece.toBand)({ x: piece.to.x, y: piece.toBand === piece.gap ? bands[piece.toBand]!.bottom : bands[piece.toBand]!.top });
      const y = laneY(piece.gap, piece.lane);
      const a = push(leave, true);
      const b = push({ x: leave.x, y }, true);
      const c = push({ x: enter.x, y }, true);
      const d = push(enter, true);
      visits.push({ gap: piece.gap, path, a, b, c, d });
    }
    return { e, path, anchors, visits };
  });
  separateDrops(drafts.flatMap((d) => d.visits));

  const gapRuns: (LaneRun | undefined)[] = [];
  const wires: SceneWire[] = drafts.map(({ e, path, anchors, visits }, w) => {
    const lanes = new Map(visits.map((v) => [v.gap, { x: (v.a.x + v.d.x) / 2, y: v.b.y }]));
    const laneRuns = new Map(visits.map((v) => [v.gap, { y: v.b.y, x0: Math.min(v.a.x, v.d.x), x1: Math.max(v.a.x, v.d.x) }]));
    for (let i = path.length - 1; i > 0; i--) if (Math.abs(path[i]!.x - path[i - 1]!.x) < 0.01 && Math.abs(path[i]!.y - path[i - 1]!.y) < 0.01) path.splice(i, 1);
    // A jog shorter than a few px is only a rounding of elk's spacing after the squash; it reads as a stray stub.
    for (let i = 1; i < path.length - 1; ) {
      const short = Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.y - path[i - 1]!.y) < MIN_SEGMENT || Math.hypot(path[i + 1]!.x - path[i]!.x, path[i + 1]!.y - path[i]!.y) < MIN_SEGMENT;
      if (short && !anchors.has(path[i]!)) {
        path.splice(i, 1);
        i = Math.max(1, i - 1);
      } else {
        i++;
      }
    }

    const lines = chipLines(e.label);
    const size = chipSize(lines);
    const centre = { x: e.labelBox.x + e.labelBox.width / 2, y: e.labelBox.y + e.labelBox.height / 2 };
    const where = locate(bands, centre.y);
    const at = "gap" in where ? (lanes.get(where.gap) ?? onPlate(where.gap)(centre)) : onPlate(where.band)(centre);
    if ("gap" in where) gapRuns[w] = laneRuns.get(where.gap);
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      type: e.type === undefined ? e.label : e.type,
      citation: e.citation,
      explanation: e.explanation,
      path,
      chip: { at, lines, box: boxAround(at, size.width, size.height) },
    };
  });

  wires.forEach((wire, w) => {
    const run = gapRuns[w];
    if (run) slideChip(wire, run, wires);
  });

  const bounds = union([
    ...plates.flatMap((p) => p.corners.map((c) => ({ x0: c.x, y0: c.y, x1: c.x, y1: c.y }))),
    ...objects.map((o) => o.box),
    ...plates.map((p) => p.mark.box),
    ...wires.map((w) => w.chip.box),
    ...wires.flatMap((w) => w.path.map((c) => ({ x0: c.x, y0: c.y, x1: c.x, y1: c.y }))),
  ]);
  const padded = { x0: bounds.x0 - SCENE_MARGIN, y0: bounds.y0 - SCENE_MARGIN, x1: bounds.x1 + SCENE_MARGIN, y1: bounds.y1 + SCENE_MARGIN };
  objects.sort((a, b) => LAYERS.indexOf(a.layer) - LAYERS.indexOf(b.layer) || a.at.y - b.at.y);
  return { scene: { plates, objects, wires, bounds: padded, width: padded.x1 - padded.x0, height: padded.y1 - padded.y0 }, onPlate };
}

export const ZOOMS = [1, 1.5, 2, 3] as const;

export interface View {
  x: number;
  y: number;
  width: number;
  height: number;
}

// The scene is seen through a canvas-sized viewBox: `origin` is the scene point at the canvas's top-left and
// `k` the screen pixels per scene unit (Fit scale times the zoom step). `free` is the part of the canvas that no island covers.
const KEEP_VISIBLE = 80;
const REVEAL_MARGIN = 12;

export function viewFor(canvas: { width: number; height: number }, k: number, origin: Point): View {
  return { x: origin.x, y: origin.y, width: canvas.width / k, height: canvas.height / k };
}

// Fit: the scene centred across the free area and its top at the free area's top.
export function homeOrigin(bounds: Box, free: Box, k: number): Point {
  return { x: (bounds.x0 + bounds.x1) / 2 - (free.x0 + free.x1) / (2 * k), y: bounds.y0 - free.y0 / k };
}

// Keeps at least KEEP_VISIBLE px of the scene inside the free area on each axis.
export function clampOrigin(bounds: Box, free: Box, k: number, origin: Point): Point {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  return {
    x: clamp(origin.x, bounds.x0 - (free.x1 - KEEP_VISIBLE) / k, bounds.x1 - (free.x0 + KEEP_VISIBLE) / k),
    y: clamp(origin.y, bounds.y0 - (free.y1 - KEEP_VISIBLE) / k, bounds.y1 - (free.y0 + KEEP_VISIBLE) / k),
  };
}

// Changes the scale while the scene point under `anchor` (canvas px) stays under it.
export function zoomAround(origin: Point, k: number, nextK: number, anchor: Point): Point {
  return { x: origin.x + anchor.x / k - anchor.x / nextK, y: origin.y + anchor.y / k - anchor.y / nextK };
}

// Moves the origin just enough that a box is inside the free area; it is left alone when it already is.
export function revealBox(origin: Point, k: number, free: Box, target: Box): Point {
  const shift = (lo: number, hi: number, freeLo: number, freeHi: number) => {
    const from = lo * k;
    const to = hi * k;
    return from < freeLo + REVEAL_MARGIN ? (from - freeLo - REVEAL_MARGIN) / k : to > freeHi - REVEAL_MARGIN ? (to - freeHi + REVEAL_MARGIN) / k : 0;
  };
  return {
    x: origin.x + shift(target.x0 - origin.x, target.x1 - origin.x, free.x0, free.x1),
    y: origin.y + shift(target.y0 - origin.y, target.y1 - origin.y, free.y0, free.y1),
  };
}
