import ELK from "elkjs/lib/elk.bundled.js";
import type { ElkExtendedEdge, ElkNode } from "elkjs/lib/elk-api";
import { LAYERS, isPictogramId, type Concept, type Layer } from "@arch-mind/rules/model";
import { OBJECT_HEIGHT, SQUASH, chipLines, chipSize } from "./metrics.ts";

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

// elk lays out the plane that the plates are projected from. A cell is the room one concept takes on screen,
// seen from above: a plate unit of depth is only SQUASH of a pixel high, so a cell is tall in plate units.
// Its width also has to hold the sheared label below the ground point.
export const CELL_WIDTH = 190;
export const CELL_HEIGHT = OBJECT_HEIGHT / SQUASH;
export const BAND_PAD = 28;
const MARGIN = 16;

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PlateNode extends Rect {
  id: string;
  designator: string;
  title: string;
  layer: Layer;
  pictogram: string;
}

export interface PlateBand {
  layer: Layer;
  top: number;
  bottom: number;
}

export interface PlateEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  citation: string;
  explanation: string;
  route: Point[];
  labelBox: Rect;
}

export interface PlateLayout {
  width: number;
  nodes: PlateNode[];
  // One cell per layer that carries the plate's pictogram and caption; elk places it so no wire crosses it.
  marks: PlateNode[];
  bands: PlateBand[];
  edges: PlateEdge[];
  shown: Record<Layer, number>;
}

const elk = new ELK();

export function pictogramFor(concept: Concept): string {
  return concept.pictogram !== undefined && isPictogramId(concept.pictogram) ? concept.pictogram : concept.layer;
}

const markId = (layer: Layer) => `mark:${layer}`;

export async function layoutConcepts(concepts: Concept[]): Promise<PlateLayout> {
  const ids = new Set(concepts.map((c) => c.id));
  const relations = concepts.flatMap((c) =>
    c.relations
      .filter((r) => ids.has(r.to) && r.to !== c.id)
      .map((r) => ({ from: c.id, to: r.to, label: r.type, citation: r.source, explanation: r.explanation })),
  );
  const names = designators(concepts);
  const cell = (id: string, layer: Layer) => ({
    id,
    width: CELL_WIDTH,
    height: CELL_HEIGHT,
    layoutOptions: { "elk.partitioning.partition": String(LAYERS.indexOf(layer)) },
  });

  const solved: ElkNode = await elk.layout({
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "DOWN",
      "elk.partitioning.activate": "true",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.separateConnectedComponents": "false",
      "elk.spacing.nodeNode": "24",
      "elk.layered.spacing.nodeNodeBetweenLayers": "24",
      "elk.spacing.edgeNode": "14",
      "elk.spacing.edgeEdge": "14",
      "elk.layered.spacing.edgeNodeBetweenLayers": "28",
      "elk.layered.spacing.edgeEdgeBetweenLayers": "14",
      "elk.spacing.edgeLabel": "6",
      "elk.edgeLabels.inline": "true",
      "elk.layered.nodePlacement.strategy": "SIMPLE",
      "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
    },
    children: [...LAYERS.map((layer) => cell(markId(layer), layer)), ...concepts.map((c) => cell(c.id, c.layer))],
    edges: relations.map((r, i) => {
      const size = chipSize(chipLines(r.label));
      return {
        id: `e${i}`,
        sources: [r.from],
        targets: [r.to],
        labels: [{ id: `l${i}`, text: r.label, width: size.width, height: size.height / SQUASH, layoutOptions: { "elk.edgeLabels.inline": "true" } }],
      };
    }),
  });

  const place = (id: string): Rect => {
    const child = solved.children!.find((n) => n.id === id)!;
    return { x: (child.x ?? 0) + MARGIN, y: child.y ?? 0, width: child.width ?? CELL_WIDTH, height: child.height ?? CELL_HEIGHT };
  };
  const nodes = concepts.map(
    (c): PlateNode => ({ id: c.id, designator: names.get(c.id)!, title: c.title, layer: c.layer, pictogram: pictogramFor(c), ...place(c.id) }),
  );
  const marks = LAYERS.map((layer): PlateNode => ({ id: markId(layer), designator: "", title: layer, layer, pictogram: layer, ...place(markId(layer)) }));

  const extents = LAYERS.map((layer) => {
    const own = [...nodes, ...marks].filter((n) => n.layer === layer);
    return { layer, top: Math.min(...own.map((n) => n.y)), bottom: Math.max(...own.map((n) => n.y + n.height)) };
  });
  // A band reaches half way into the gap to its neighbour, at most BAND_PAD, so bands never overlap.
  const bands = extents.map((e, i): PlateBand => {
    const before = extents[i - 1];
    const after = extents[i + 1];
    return {
      layer: e.layer,
      top: e.top - Math.min(BAND_PAD, before ? Math.max(0, (e.top - before.bottom) / 2) : BAND_PAD),
      bottom: e.bottom + Math.min(BAND_PAD, after ? Math.max(0, (after.top - e.bottom) / 2) : BAND_PAD),
    };
  });

  const edges = relations.map((r, i): PlateEdge => {
    const solvedEdge = (solved.edges as ElkExtendedEdge[]).find((e) => e.id === `e${i}`)!;
    const section = solvedEdge.sections![0]!;
    const label = solvedEdge.labels![0]!;
    const route = [section.startPoint, ...(section.bendPoints ?? []), section.endPoint].map((p) => ({ x: p.x + MARGIN, y: p.y }));
    return {
      id: `e${i}`,
      source: r.from,
      target: r.to,
      label: r.label,
      citation: r.citation,
      explanation: r.explanation,
      route,
      labelBox: { x: (label.x ?? 0) + MARGIN, y: label.y ?? 0, width: label.width ?? 0, height: label.height ?? 0 },
    };
  });

  const shown = { client: 0, network: 0, server: 0, data: 0 } satisfies Record<Layer, number>;
  for (const c of concepts) shown[c.layer]++;
  const right = Math.max(...[...nodes, ...marks].map((n) => n.x + n.width), ...edges.map((e) => e.labelBox.x + e.labelBox.width));
  return { width: right + MARGIN, nodes, marks, bands, edges, shown };
}
