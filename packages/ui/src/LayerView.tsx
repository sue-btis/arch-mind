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
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Concept, Layer } from "@arch-mind/rules/model";
import { useEffect, useMemo, useRef, useState } from "react";
import { layoutConcepts, type Layout, type LayoutEdge } from "./layout.ts";

type ConnectorData = { designator: string; title: string; layer: Layer };
type BandData = { layer: Layer; width: number; height: number };
type WireData = { edge: LayoutEdge; dx: number };

function Connector({ data }: NodeProps<Node<ConnectorData>>) {
  return (
    <div
      className="flex h-full items-center gap-2 border bg-board px-2.5 text-[13px]"
      style={{ borderColor: `var(--layer-${data.layer})` }}
      role="group"
      aria-label={`${data.designator} ${data.title}`}
    >
      <span className="text-[11px] font-semibold" style={{ color: `var(--layer-${data.layer})` }}>
        {data.designator}
      </span>
      <span className="truncate" title={data.title}>
        {data.title}
      </span>
      <Handle type="source" position={Position.Bottom} className="opacity-0!" />
      <Handle type="target" position={Position.Top} className="opacity-0!" />
    </div>
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
      <span
        className="absolute left-4 top-2 text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: `var(--layer-${data.layer})` }}
      >
        {data.layer}
      </span>
    </div>
  );
}

// elk routed the wire; React Flow only draws it, so the handles' own geometry is ignored.
function Wire({ id, data, markerEnd, style }: EdgeProps<Edge<WireData>>) {
  const { edge, dx } = data!;
  const path = edge.points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x + dx},${p.y}`).join(" ");
  return (
    <BaseEdge
      id={id}
      path={path}
      markerEnd={markerEnd}
      style={style}
      label={edge.label}
      labelX={edge.labelAt.x + dx}
      labelY={edge.labelAt.y}
      labelBgPadding={[4, 2]}
    />
  );
}

const nodeTypes = { connector: Connector, band: Band };
const edgeTypes = { wire: Wire };

function toFlow(layout: Layout, boardWidth: number): { nodes: Node[]; edges: Edge[] } {
  const dx = Math.max(0, (boardWidth - layout.width) / 2);
  const bands: Node<BandData>[] = layout.bands.map((b) => ({
    id: `band-${b.layer}`,
    type: "band",
    position: { x: 0, y: b.y },
    data: { layer: b.layer, width: boardWidth, height: b.height },
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
    data: { designator: n.designator, title: n.title, layer: n.layer },
    width: n.width,
    height: n.height,
  }));
  const edges: Edge<WireData>[] = layout.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: "wire",
    data: { edge: e, dx },
    markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: "var(--wire)" },
    style: { stroke: "var(--wire)", strokeWidth: 1 },
  }));
  return { nodes: [...bands, ...connectors], edges };
}

export function LayerView({ concepts }: { concepts: Concept[] }) {
  const [layout, setLayout] = useState<Layout | null>(null);
  const [width, setWidth] = useState(0);
  const wrapper = useRef<HTMLDivElement>(null);
  const flow = useRef<ReactFlowInstance | null>(null);

  useEffect(() => {
    let current = true;
    layoutConcepts(concepts).then((l) => current && setLayout(l));
    return () => {
      current = false;
    };
  }, [concepts]);

  useEffect(() => {
    const el = wrapper.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const zoom = layout && width > 0 ? Math.min(1, width / layout.width) : 1;
  useEffect(() => {
    void flow.current?.setViewport({ x: 0, y: 0, zoom });
  }, [zoom, layout]);

  const boardWidth = Math.max(layout?.width ?? 0, width / zoom);
  const graph = useMemo(() => (layout ? toFlow(layout, boardWidth) : null), [layout, boardWidth]);

  return (
    <div ref={wrapper} className="border border-line bg-board" data-testid="board" data-zoom={zoom}>
      {graph && layout && (
        <div style={{ height: Math.ceil(layout.height * zoom) }}>
          <ReactFlow
            nodes={graph.nodes}
            edges={graph.edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onInit={(instance) => {
              flow.current = instance;
              void instance.setViewport({ x: 0, y: 0, zoom });
            }}
            defaultViewport={{ x: 0, y: 0, zoom }}
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
    </div>
  );
}
