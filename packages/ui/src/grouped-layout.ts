import ELK from "elkjs/lib/elk.bundled.js";
import type { ElkExtendedEdge, ElkNode } from "elkjs/lib/elk-api";
import { LAYERS, type Concept, type Layer } from "@arch-mind/rules/model";
import { BAND_PAD, CELL_HEIGHT, CELL_WIDTH, designators, pictogramFor, type PlateBand, type PlateEdge, type PlateLayout, type PlateNode, type Rect } from "./layout.ts";
import { groupConcepts, groupIdOf } from "./grouping.ts";
import { SHEAR, SQUASH, chipLines, chipSize } from "./metrics.ts";

export interface PlateGroup extends Rect {
  id: string;
  layer: Layer;
  domain: string;
  count: number;
  open: boolean;
}

// A grouped layout is a PlateLayout whose closed groups are ordinary nodes and whose open group is replaced by its concept nodes; the open group's rect is the box around them.
export interface GroupedLayout extends PlateLayout {
  groups: PlateGroup[];
  // The relation types each edge stands for, so the legend can keep an edge prominent when any of them matches.
  types: Record<string, string[]>;
}

const elk = new ELK();
const MARGIN = 16;

interface Link {
  from: string;
  to: string;
  types: string[];
  citation: string;
  explanation: string;
}

export async function layoutGrouped(concepts: Concept[], openGroup: string | null = null, names = designators(concepts)): Promise<GroupedLayout> {
  const ids = new Set(concepts.map((c) => c.id));
  const own = groupIdOf;
  const inOpen = (c: Concept) => own(c) === openGroup;
  const endpoint = (c: Concept) => (inOpen(c) ? c.id : own(c));
  const byId = new Map(concepts.map((c) => [c.id, c]));

  const links = new Map<string, Link>();
  for (const c of concepts) {
    for (const r of c.relations) {
      const target = byId.get(r.to);
      if (!target || !ids.has(r.to) || target.id === c.id) continue;
      const from = endpoint(c);
      const to = endpoint(target);
      if (from === to) continue;
      const inside = inOpen(c) && inOpen(target);
      const key = inside ? `${c.id}>${r.to}>${r.type}` : `${from}>${to}`;
      const link = links.get(key) ?? { from, to, types: [], citation: r.source, explanation: r.explanation };
      link.types.push(r.type);
      links.set(key, link);
    }
  }
  const edgesIn = [...links.values()];
  const sharedType = (l: Link) => (l.types.every((t) => t === l.types[0]) ? l.types[0]! : null);
  const labelOf = (l: Link) => (l.types.length === 1 ? l.types[0]! : `${l.types.length} ${sharedType(l) ?? ""}`.trim());

  const groupList = groupConcepts(concepts);

  const partition = (layer: Layer) => ({ "elk.partitioning.partition": String(LAYERS.indexOf(layer)) });
  const cell = (id: string, layer: Layer): ElkNode => ({ id, width: CELL_WIDTH, height: CELL_HEIGHT, layoutOptions: partition(layer) });
  const markId = (layer: Layer) => `mark:${layer}`;

  const children: ElkNode[] = LAYERS.map((layer) => cell(markId(layer), layer));
  for (const g of groupList) {
    const id = g.id;
    if (id === openGroup) children.push(...g.members.map((c) => cell(c.id, c.layer)));
    else children.push(cell(id, g.layer));
  }

  const solved: ElkNode = await elk.layout({
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "DOWN",
      "elk.partitioning.activate": "true",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.separateConnectedComponents": "false",
      "elk.spacing.nodeNode": "24",
      "elk.layered.spacing.nodeNodeBetweenLayers": "64",
      "elk.spacing.edgeNode": "14",
      "elk.spacing.edgeEdge": "40",
      "elk.layered.spacing.edgeNodeBetweenLayers": "28",
      "elk.layered.spacing.edgeEdgeBetweenLayers": "28",
      "elk.spacing.edgeLabel": "6",
      "elk.edgeLabels.inline": "true",
      "elk.layered.nodePlacement.strategy": "SIMPLE",
      "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
    },
    children,
    edges: edgesIn.map((l, i) => {
      const size = chipSize(chipLines(labelOf(l)));
      return {
        id: `e${i}`,
        sources: [l.from],
        targets: [l.to],
        labels: [{ id: `l${i}`, text: labelOf(l), width: size.width + (SHEAR * size.height) / SQUASH, height: size.height / SQUASH, layoutOptions: { "elk.edgeLabels.inline": "true" } }],
      };
    }),
  });

  const absolute = new Map<string, Rect>();
  for (const n of solved.children!) absolute.set(n.id, { x: (n.x ?? 0) + MARGIN, y: n.y ?? 0, width: n.width ?? CELL_WIDTH, height: n.height ?? CELL_HEIGHT });
  const place = (id: string) => absolute.get(id)!;
  const boxOf = (rects: Rect[]): Rect => {
    const x = Math.min(...rects.map((r) => r.x));
    const y = Math.min(...rects.map((r) => r.y));
    return { x, y, width: Math.max(...rects.map((r) => r.x + r.width)) - x, height: Math.max(...rects.map((r) => r.y + r.height)) - y };
  };

  const nodes: PlateNode[] = [];
  const groups: PlateGroup[] = [];
  for (const g of groupList) {
    const id = g.id;
    const open = id === openGroup;
    groups.push({ id, layer: g.layer, domain: g.domain, count: g.members.length, open, ...(open ? boxOf(g.members.map((c) => place(c.id))) : place(id)) });
    if (open) {
      for (const c of g.members) nodes.push({ id: c.id, designator: names.get(c.id)!, title: c.title, layer: c.layer, pictogram: pictogramFor(c), ...place(c.id) });
    } else {
      nodes.push({ id, designator: String(g.members.length), title: g.domain, layer: g.layer, pictogram: g.layer, ...place(id) });
    }
  }
  const marks = LAYERS.map((layer): PlateNode => ({ id: markId(layer), designator: "", title: layer, layer, pictogram: layer, ...place(markId(layer)) }));

  const bands = LAYERS.map((layer): PlateBand => {
    const rects = [...nodes, ...marks].filter((n) => n.layer === layer);
    return { layer, top: Math.min(...rects.map((n) => n.y)) - BAND_PAD, bottom: Math.max(...rects.map((n) => n.y + n.height)) + BAND_PAD };
  });

  const edges = edgesIn.map((l, i): PlateEdge => {
    const solvedEdge = (solved.edges as ElkExtendedEdge[]).find((e) => e.id === `e${i}`)!;
    const section = solvedEdge.sections![0]!;
    const label = solvedEdge.labels![0]!;
    const route = [section.startPoint, ...(section.bendPoints ?? []), section.endPoint].map((p) => ({ x: p.x + MARGIN, y: p.y }));
    const single = l.types.length === 1;
    return {
      id: `e${i}`,
      source: l.from,
      target: l.to,
      label: labelOf(l),
      type: sharedType(l),
      citation: single ? l.citation : "",
      explanation: single ? l.explanation : `${l.types.length} relations`,
      route,
      labelBox: { x: (label.x ?? 0) + MARGIN, y: label.y ?? 0, width: label.width ?? 0, height: label.height ?? 0 },
    };
  });

  const shown = { client: 0, network: 0, server: 0, data: 0 } satisfies Record<Layer, number>;
  for (const c of concepts) shown[c.layer]++;
  const right = Math.max(...[...nodes, ...marks].map((n) => n.x + n.width), ...edges.map((e) => e.labelBox.x + e.labelBox.width));
  return { width: right + MARGIN, nodes, marks, bands, edges, shown, groups, types: Object.fromEntries(edgesIn.map((l, i) => [`e${i}`, l.types])) };
}
