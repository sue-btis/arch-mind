import {
  BaseEdge,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Concept, Layer } from "@arch-mind/rules/model";
import { useEffect, useMemo, useRef, useState } from "react";
import { FitMessage } from "./FitMessage.tsx";
import { layoutConcepts, type Layout, type LayoutEdge } from "./layout.ts";
import { RelationPopover, useRelationPopover, type RelationInfo, type RelationTargetProps } from "./Popover.tsx";
import { wireCode, wireStyle } from "./wire-code.ts";

const SETTLE_MS = 320;

type ConnectorData = { id: string; designator: string; title: string; layer: Layer; onOpen: OpenConcept };
type BandData = { layer: Layer; width: number; height: number; empty: boolean };
type WireData = {
  edge: LayoutEdge;
  dx: number;
  from: string;
  to: string;
  targetProps: (key: string, relations: RelationInfo[]) => RelationTargetProps;
};

export type OpenConcept = (id: string, opener: HTMLElement) => void;

function Connector({ data }: NodeProps<Node<ConnectorData>>) {
  return (
    <button
      type="button"
      className="flex h-full w-full items-center gap-2 border bg-board px-2.5 text-left text-[13px]"
      style={{ borderColor: `var(--layer-${data.layer})`, pointerEvents: "all" }}
      aria-label={`${data.designator} ${data.title}`}
      onClick={(e) => data.onOpen(data.id, e.currentTarget)}
    >
      <span className="text-[11px] font-semibold tabular-nums" style={{ color: `var(--layer-${data.layer})` }}>
        {data.designator}
      </span>
      <span className="line-clamp-2 break-words leading-tight" title={data.title}>
        {data.title}
      </span>
      <Handle type="source" position={Position.Bottom} className="opacity-0!" />
      <Handle type="target" position={Position.Top} className="opacity-0!" />
    </button>
  );
}

function Band({ data }: NodeProps<Node<BandData>>) {
  return (
    <div
      className="relative border-b border-t border-line"
      style={{
        width: data.width,
        height: data.height,
        background: `color-mix(in srgb, var(--layer-${data.layer}) 7%, transparent)`,
      }}
    >
      <span className={`absolute left-4 flex items-baseline gap-3 ${data.empty ? "top-1/2 -translate-y-1/2" : "top-2"}`}>
        <span data-band-name className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: `var(--layer-${data.layer})` }}>
          {data.layer}
        </span>
        {data.empty && <span className="text-[11px] text-ink-muted">no concepts shown</span>}
      </span>
    </div>
  );
}

// elk routed the wire; React Flow only draws it, so the handles' own geometry is ignored.
function Wire({ id, data, markerEnd, style }: EdgeProps<Edge<WireData>>) {
  const { edge, dx, from, to, targetProps } = data!;
  const path = edge.points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x + dx},${p.y}`).join(" ");
  const props = targetProps(id, [{ type: edge.label, from, to, source: edge.citation, explanation: edge.explanation }]);
  return (
    <g
      className="wire"
      data-relation-target
      tabIndex={0}
      role="button"
      aria-label={`${edge.label}: ${from} to ${to}`}
      style={{ pointerEvents: "none" }}
      {...props}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        props.onClick(e);
      }}
    >
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={style}
        label={edge.label}
        labelX={edge.labelAt.x + dx}
        labelY={edge.labelAt.y}
        labelBgPadding={[4, 2]}
        interactionWidth={0}
      />
      <path d={path} fill="none" stroke="transparent" strokeWidth={14} style={{ pointerEvents: "stroke" }} />
    </g>
  );
}

const nodeTypes = { connector: Connector, band: Band };
const edgeTypes = { wire: Wire };

function toFlow(
  layout: Layout,
  boardWidth: number,
  onOpen: OpenConcept,
  targetProps: WireData["targetProps"],
): { nodes: Node[]; edges: Edge[] } {
  const dx = Math.max(0, (boardWidth - layout.width) / 2);
  const titles = new Map(layout.nodes.map((n) => [n.id, `${n.designator} ${n.title}`]));
  const bands: Node<BandData>[] = layout.bands.map((b) => ({
    id: `band-${b.layer}`,
    type: "band",
    position: { x: 0, y: b.y },
    data: { layer: b.layer, width: boardWidth, height: b.height, empty: b.empty },
    width: boardWidth,
    height: b.height,
    zIndex: -1,
    draggable: false,
    selectable: false,
    focusable: false,
  }));
  const connectors: Node<ConnectorData>[] = layout.nodes.map((n) => ({
    id: n.id,
    type: "connector",
    position: { x: n.x + dx, y: n.y },
    data: { id: n.id, designator: n.designator, title: n.title, layer: n.layer, onOpen },
    width: n.width,
    height: n.height,
  }));
  const edges: Edge<WireData>[] = layout.edges.map((e) => {
    const style = wireStyle(wireCode(e.label));
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      type: "wire",
      data: { edge: e, dx, from: titles.get(e.source) ?? e.source, to: titles.get(e.target) ?? e.target, targetProps },
      markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: style.stroke },
      style: { ...style, strokeWidth: 1 },
    };
  });
  return { nodes: [...bands, ...connectors], edges };
}

export function LayerView({
  concepts,
  boardWidth,
  onOpen,
  onMeasure,
}: {
  concepts: Concept[];
  boardWidth: number;
  onOpen: OpenConcept;
  onMeasure: (needed: number) => void;
}) {
  const [layout, setLayout] = useState<Layout | null>(null);
  const [settling, setSettling] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const laidOut = useRef(false);
  const { open, targetProps } = useRelationPopover(container);

  useEffect(() => {
    let current = true;
    layoutConcepts(concepts).then((l) => current && setLayout(l));
    return () => {
      current = false;
    };
  }, [concepts]);

  useEffect(() => {
    if (!layout) return;
    if (!laidOut.current) {
      laidOut.current = true;
      return;
    }
    setSettling(true);
    const timer = setTimeout(() => setSettling(false), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [layout]);

  useEffect(() => {
    if (layout) onMeasure(layout.width);
  }, [layout, onMeasure]);

  const fits = layout !== null && layout.width <= boardWidth;
  const graph = useMemo(
    () => (layout && fits ? toFlow(layout, boardWidth, onOpen, targetProps) : null),
    [layout, fits, boardWidth, onOpen, targetProps],
  );

  if (layout && boardWidth > 0 && !fits) return <FitMessage count={concepts.length} needed={layout.width} available={boardWidth} />;
  return (
    <div ref={container} className="relative" data-settling={settling || undefined}>
      {graph && layout && (
        <div style={{ height: layout.height }}>
          <ReactFlow
            proOptions={{ hideAttribution: true }}
            nodes={graph.nodes}
            edges={graph.edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
            panOnDrag={false}
            zoomOnScroll={false}
            zoomOnPinch={false}
            zoomOnDoubleClick={false}
            preventScrolling={false}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            nodesFocusable={false}
            edgesFocusable={false}
            colorMode="system"
          />
        </div>
      )}
      <RelationPopover open={open} container={container} />
    </div>
  );
}
