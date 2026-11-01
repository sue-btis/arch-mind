import ELK from "elkjs/lib/elk.bundled.js";
import type { ElkExtendedEdge } from "elkjs/lib/elk-api";
import { LAYERS, type Concept, type Layer } from "@arch-mind/rules/model";

export function designators(concepts: Concept[]): Map<string, string> {
  const counters = new Map<Layer, number>();
  return new Map(
    concepts.map((c) => {
      const index = (counters.get(c.layer) ?? 0) + 1;
      counters.set(c.layer, index);
      return [c.id, `${c.layer[0]!.toUpperCase()}${index}`];
    }),
  );
}

export const NODE_WIDTH = 176;
export const NODE_HEIGHT = 48;
const MARGIN = 16;
const BAND_PAD_TOP = 30;
const BAND_PAD_BOTTOM = 14;
const BAND_GAP = 12;
const EMPTY_BAND_HEIGHT = 28;

export interface Point {
  x: number;
  y: number;
}

export interface LayoutNode {
  id: string;
  designator: string;
  title: string;
  layer: Layer;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutBand {
  layer: Layer;
  y: number;
  height: number;
}

export interface LayoutEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  citation: string;
  explanation: string;
  points: Point[];
  labelAt: Point;
}

export interface Layout {
  width: number;
  height: number;
  nodes: LayoutNode[];
  bands: LayoutBand[];
  edges: LayoutEdge[];
}

const elk = new ELK();

export async function layoutConcepts(concepts: Concept[]): Promise<Layout> {
  const ids = new Set(concepts.map((c) => c.id));
  const relations = concepts.flatMap((c) =>
    c.relations
      .filter((r) => ids.has(r.to) && r.to !== c.id)
      .map((r) => ({ from: c.id, to: r.to, label: r.type, citation: r.source, explanation: r.explanation })),
  );

  const solved = await elk.layout({
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "DOWN",
      "elk.partitioning.activate": "true",
      "elk.spacing.nodeNode": "24",
      "elk.layered.spacing.nodeNodeBetweenLayers": "64",
      "elk.edgeRouting": "ORTHOGONAL",
    },
    children: concepts.map((c) => ({
      id: c.id,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      layoutOptions: { "elk.partitioning.partition": String(LAYERS.indexOf(c.layer)) },
    })),
    edges: relations.map((r, i) => ({ id: `e${i}`, sources: [r.from], targets: [r.to] })),
  });

  const names = designators(concepts);
  const raw = concepts.map((c): LayoutNode => {
    const child = solved.children?.find((n) => n.id === c.id);
    return {
      id: c.id,
      designator: names.get(c.id)!,
      title: c.title,
      layer: c.layer,
      x: (child?.x ?? 0) + MARGIN,
      y: child?.y ?? 0,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    };
  });

  // Bands hug the nodes elk placed in each partition. An empty layer gets a thin
  // band (DEC-Q3): everything below the cut moves down, which keeps every
  // orthogonal edge orthogonal because a segment's two ends share one shift.
  const extents = LAYERS.map((layer) => {
    const own = raw.filter((n) => n.layer === layer);
    if (own.length === 0) return null;
    return {
      top: Math.min(...own.map((n) => n.y)) - BAND_PAD_TOP,
      bottom: Math.max(...own.map((n) => n.y + n.height)) + BAND_PAD_BOTTOM,
    };
  });
  const tops = extents.filter((e) => e !== null).map((e) => e.top);
  const origin = tops.length > 0 ? Math.min(...tops) : 0;
  const cuts: number[] = [];
  const shiftAt = (y: number) => cuts.filter((c) => c <= y).length * (EMPTY_BAND_HEIGHT + BAND_GAP);

  const bands: LayoutBand[] = [];
  let previousBottom = origin - BAND_GAP;
  LAYERS.forEach((layer, i) => {
    const extent = extents[i];
    if (extent) {
      bands.push({ layer, y: extent.top + shiftAt(extent.top) - origin, height: extent.bottom - extent.top });
      previousBottom = extent.bottom;
    } else {
      const cut = previousBottom + BAND_GAP;
      bands.push({ layer, y: cut + shiftAt(cut) - origin, height: EMPTY_BAND_HEIGHT });
      cuts.push(cut);
      previousBottom = cut - BAND_GAP;
    }
  });

  const nodes = raw.map((n) => ({ ...n, y: n.y + shiftAt(n.y) - origin }));
  const edges = relations.map((r, i): LayoutEdge => {
    const section = (solved.edges as ElkExtendedEdge[] | undefined)?.find((e) => e.id === `e${i}`)?.sections?.[0];
    const points = section
      ? [section.startPoint, ...(section.bendPoints ?? []), section.endPoint].map((p) => ({
          x: p.x + MARGIN,
          y: p.y + shiftAt(p.y) - origin,
        }))
      : [];
    return {
      id: `e${i}`,
      source: r.from,
      target: r.to,
      label: r.label,
      citation: r.citation,
      explanation: r.explanation,
      points,
      labelAt: labelPoint(points, r.label, nodes),
    };
  });

  const last = bands[bands.length - 1]!;
  const width = Math.max(...nodes.map((n) => n.x + n.width), 0) + MARGIN;
  return { width: Math.max(width, 2 * MARGIN), height: last.y + last.height, nodes, bands, edges };
}

// Candidate spots run along the longest segments first; the first one whose text box
// clears every connector wins, otherwise the middle of the longest segment.
function labelPoint(points: Point[], label: string, nodes: LayoutNode[]): Point {
  const segments = points
    .slice(1)
    .map((b, i) => ({ a: points[i]!, b }))
    .sort((s1, s2) => length(s2) - length(s1));
  const halfWidth = label.length * 3.4 + 6;
  const halfHeight = 9;
  const clear = (p: Point) =>
    nodes.every(
      (n) =>
        p.x + halfWidth < n.x || p.x - halfWidth > n.x + n.width || p.y + halfHeight < n.y || p.y - halfHeight > n.y + n.height,
    );
  for (const { a, b } of segments) {
    for (const t of [0.5, 0.3, 0.7]) {
      const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      if (clear(p)) return p;
    }
  }
  const first = segments[0];
  return first ? { x: (first.a.x + first.b.x) / 2, y: (first.a.y + first.b.y) / 2 } : { x: 0, y: 0 };
}

function length({ a, b }: { a: Point; b: Point }) {
  return Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
}
