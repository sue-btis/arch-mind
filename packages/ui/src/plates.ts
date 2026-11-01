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

const PLATE_GAP = 24;
const SCENE_MARGIN = 12;
const MIN_SEGMENT = 9;

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

interface Region {
  y0: number;
  y1: number;
  at: (p: Point) => Point;
}

// The elk plane is cut into one band per plate and the gaps between them. A band maps onto its plate; a gap maps
// onto the screen gap between two plates, so a wire that crosses it stays one continuous line.
function regionsFor(bands: PlateBand[]): { regions: Region[]; bandRegions: Region[] } {
  const regions: Region[] = [];
  const bandRegions: Region[] = [];
  let offset = 0;
  bands.forEach((band, i) => {
    const depth = band.bottom - band.top;
    const start = offset;
    const region: Region = {
      y0: band.top,
      y1: band.bottom,
      at: (p) => {
        const v = p.y - band.top;
        return { x: p.x - SHEAR * v, y: start + SQUASH * v };
      },
    };
    regions.push(region);
    bandRegions.push(region);
    const front = start + SQUASH * depth;
    const following = bands[i + 1];
    const gap = following ? Math.max(0, following.top - band.bottom) : 0;
    const screenGap = PLATE_GAP + SQUASH * gap;
    if (following && gap > 0) {
      regions.push({
        y0: band.bottom,
        y1: following.top,
        at: (p) => {
          const t = (p.y - band.bottom) / gap;
          return { x: p.x - SHEAR * depth * (1 - t), y: front + t * screenGap };
        },
      });
    }
    offset = front + screenGap;
  });
  return { regions, bandRegions };
}

function regionAt(regions: Region[], y: number): Region {
  const found = regions.find((r) => y >= r.y0 && y <= r.y1);
  if (found) return found;
  return y < regions[0]!.y0 ? regions[0]! : regions[regions.length - 1]!;
}

// A vertical run that crosses regions gets a point at each region edge, so it bends exactly where the mapping does.
function projectPolyline(regions: Region[], route: Point[]): Point[] {
  const out: Point[] = [];
  const push = (p: Point) => {
    const last = out[out.length - 1];
    if (!last || Math.abs(last.x - p.x) > 0.01 || Math.abs(last.y - p.y) > 0.01) out.push(p);
  };
  route.forEach((p, i) => {
    const from = route[i - 1];
    if (!from) return push(regionAt(regions, p.y).at(p));
    if (from.x !== p.x || from.y === p.y) return push(regionAt(regions, p.y).at(p));
    const down = p.y > from.y;
    const lo = Math.min(from.y, p.y);
    const hi = Math.max(from.y, p.y);
    const crossed = regions.filter((r) => r.y1 > lo && r.y0 < hi);
    if (!down) crossed.reverse();
    for (const r of crossed) {
      const a = Math.max(r.y0, lo);
      const b = Math.min(r.y1, hi);
      push(r.at({ x: p.x, y: down ? a : b }));
      push(r.at({ x: p.x, y: down ? b : a }));
    }
    if (crossed.length === 0) push(regionAt(regions, p.y).at(p));
  });
  // A jog shorter than a few px is only a rounding of elk's spacing after the squash; it reads as a stray stub.
  for (let i = 1; i < out.length - 1; ) {
    const short = Math.hypot(out[i]!.x - out[i - 1]!.x, out[i]!.y - out[i - 1]!.y) < MIN_SEGMENT || Math.hypot(out[i + 1]!.x - out[i]!.x, out[i + 1]!.y - out[i]!.y) < MIN_SEGMENT;
    if (short) {
      out.splice(i, 1);
      i = Math.max(1, i - 1);
    } else {
      i++;
    }
  }
  return out;
}

function boxAround(at: Point, width: number, height: number): Box {
  return { x0: at.x - width / 2, y0: at.y - height / 2, x1: at.x + width / 2, y1: at.y + height / 2 };
}

function union(boxes: Box[]): Box {
  return {
    x0: Math.min(...boxes.map((b) => b.x0)),
    y0: Math.min(...boxes.map((b) => b.y0)),
    x1: Math.max(...boxes.map((b) => b.x1)),
    y1: Math.max(...boxes.map((b) => b.y1)),
  };
}

function sceneObject(n: PlateNode, band: Region, caption?: string): SceneObject {
  const ground = n.y + GROUND_FRACTION * n.height;
  const at = band.at({ x: n.x + n.width / 2, y: ground });
  const lines = caption === undefined ? labelLines(n.designator, n.title) : [caption];
  const widest = Math.max(...lines.map((line, i) => textWidth(i === 0 && caption === undefined ? `${n.designator} ${line}` : line)));
  const pictogram: Box = { x0: at.x - PICTOGRAM_PX / 2, y0: at.y - GROUND.y, x1: at.x + PICTOGRAM_PX / 2, y1: at.y - GROUND.y + PICTOGRAM_PX };
  const label: Box = { x0: at.x - widest / 2, y0: at.y + LABEL_OFFSET, x1: at.x + widest / 2, y1: at.y + LABEL_OFFSET + lines.length * LINE_HEIGHT };
  const cell = [
    { x: n.x, y: n.y },
    { x: n.x + n.width, y: n.y },
    { x: n.x + n.width, y: n.y + n.height },
    { x: n.x, y: n.y + n.height },
  ].map((p) => band.at(p));
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

export function buildScene(layout: PlateLayout): Scene {
  const { regions, bandRegions } = regionsFor(layout.bands);
  const regionOf = (layer: Layer) => bandRegions[LAYERS.indexOf(layer)]!;
  const objects = layout.nodes.map((n) => sceneObject(n, regionOf(n.layer)));

  const plates: ScenePlate[] = LAYERS.map((layer, i) => {
    const band = layout.bands[i]!;
    const region = bandRegions[i]!;
    const corners = [
      { x: 0, y: band.top },
      { x: layout.width, y: band.top },
      { x: layout.width, y: band.bottom },
      { x: 0, y: band.bottom },
    ].map(region.at);
    return {
      layer,
      corners,
      mark: sceneObject(layout.marks[i]!, region, `${layer.toUpperCase()} ${layout.shown[layer]} shown`),
      shown: layout.shown[layer],
      emptyAt: region.at({ x: layout.width * 0.75, y: (band.top + band.bottom) / 2 }),
    };
  });

  const wires: SceneWire[] = layout.edges.map((e) => {
    const lines = chipLines(e.label);
    const size = chipSize(lines);
    const centre = { x: e.labelBox.x + e.labelBox.width / 2, y: e.labelBox.y + e.labelBox.height / 2 };
    const at = regionAt(regions, centre.y).at(centre);
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      citation: e.citation,
      explanation: e.explanation,
      path: projectPolyline(regions, e.route),
      chip: { at, lines, box: boxAround(at, size.width, size.height) },
    };
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
  return { plates, objects, wires, bounds: padded, width: padded.x1 - padded.x0, height: padded.y1 - padded.y0 };
}

export const ZOOMS = [1, 1.5, 2, 3] as const;

export interface View {
  x: number;
  y: number;
  width: number;
  height: number;
}

// The view keeps its centre inside the scene, so zooming in never shows empty space around the plates.
export function viewFor(bounds: Box, zoom: number, centre: Point): View {
  const width = (bounds.x1 - bounds.x0) / zoom;
  const height = (bounds.y1 - bounds.y0) / zoom;
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  return {
    x: clamp(centre.x - width / 2, bounds.x0, bounds.x1 - width),
    y: clamp(centre.y - height / 2, bounds.y0, bounds.y1 - height),
    width,
    height,
  };
}

export function centreOf(bounds: Box): Point {
  return { x: (bounds.x0 + bounds.x1) / 2, y: (bounds.y0 + bounds.y1) / 2 };
}

// Moves the view just enough that a focused box is inside it; the view is left alone when it already is.
export function followBox(view: View, target: Box): Point {
  const shift = (lo: number, hi: number, vLo: number, vHi: number) => (lo < vLo ? lo - vLo : hi > vHi ? hi - vHi : 0);
  return {
    x: view.x + view.width / 2 + shift(target.x0, target.x1, view.x, view.x + view.width),
    y: view.y + view.height / 2 + shift(target.y0, target.y1, view.y, view.y + view.height),
  };
}
