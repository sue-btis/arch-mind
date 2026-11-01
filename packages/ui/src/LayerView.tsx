import { LAYERS, PICTOGRAMS, type Concept } from "@arch-mind/rules/model";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { FitMessage } from "./FitMessage.tsx";
import { layoutConcepts, type PlateLayout, type Point } from "./layout.ts";
import {
  FIT_FLOOR,
  GROUND,
  LABEL_OFFSET,
  LINE_HEIGHT,
  PICTOGRAM_PX,
  ZOOMS,
  buildScene,
  clampOrigin,
  fitScale,
  homeOrigin,
  isRefused,
  revealBox,
  viewFor,
  zoomAround,
  type Box,
  type SceneObject,
  type SceneWire,
} from "./plates.ts";
import { RelationPopover, useRelationPopover, type RelationInfo, type RelationTargetProps } from "./Popover.tsx";
import { wireCode, wireStyle } from "./wire-code.ts";

const SETTLE_MS = 320;
const STEP_MS = 160;
const MARKER_CODES = ["requires", "complements", "contains", "alternative", "other"] as const;
const MEANING = new Map(PICTOGRAMS.map((p) => [p.id, p.meaning]));

export type OpenConcept = (id: string, opener: HTMLElement | SVGElement) => void;

const layerStyle = (layer: string): CSSProperties => ({ "--k": `var(--layer-${layer})` }) as CSSProperties;
const polyline = (points: Point[]) => points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
const markerId = (type: string) => `m-${wireCode(type) ?? "other"}`;

function Wire({
  wire,
  from,
  to,
  targetProps,
}: {
  wire: SceneWire;
  from: string;
  to: string;
  targetProps: (key: string, relations: RelationInfo[]) => RelationTargetProps;
}) {
  const props = targetProps(wire.id, [{ type: wire.label, from, to, source: wire.citation, explanation: wire.explanation }]);
  const d = polyline(wire.path);
  return (
    <g
      className="wire"
      data-testid="wire"
      data-relation-target
      tabIndex={0}
      role="button"
      aria-label={`${wire.label}: ${from} to ${to}`}
      {...props}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        props.onClick(e);
      }}
    >
      <path className="hit" d={d} />
      <path className="line" d={d} style={wireStyle(wireCode(wire.label))} markerEnd={`url(#${markerId(wire.label)})`} />
    </g>
  );
}

function ConceptMark({ object, onOpen, onFocus }: { object: SceneObject; onOpen: OpenConcept; onFocus: (box: Box) => void }) {
  const meaning = MEANING.get(object.pictogram) ?? object.pictogram;
  return (
    <g
      className="obj"
      data-testid="concept"
      data-id={object.id}
      data-pictogram={object.pictogram}
      tabIndex={0}
      role="button"
      aria-label={`${object.designator} ${object.title}`}
      style={{ ...layerStyle(object.layer), transform: `translate(${object.at.x}px, ${object.at.y}px)` }}
      onClick={(e) => onOpen(object.id, e.currentTarget)}
      onFocus={() => onFocus(object.box)}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        onOpen(object.id, e.currentTarget);
      }}
    >
      <title>{`${object.designator} ${object.title}: ${meaning}`}</title>
      <ellipse className="focus" rx={32} ry={16} />
      <use className="pic" href={`#${object.pictogram}`} x={-GROUND.x} y={-GROUND.y} width={PICTOGRAM_PX} height={PICTOGRAM_PX} />
      <text className="nlab" textAnchor="middle">
        {object.lines.map((line, i) => (
          <tspan key={i} x={0} y={LABEL_OFFSET + 11 + i * LINE_HEIGHT}>
            {i === 0 && <tspan className="des">{object.designator} </tspan>}
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

export function LayerView({
  concepts,
  canvas,
  base,
  sheet,
  revealId,
  onOpen,
}: {
  concepts: Concept[];
  canvas: { width: number; height: number };
  // The part of the canvas no island covers, and how much of its right side the open detail sheet takes.
  base: Box;
  sheet: number;
  revealId: string | null;
  onOpen: OpenConcept;
}) {
  const [layout, setLayout] = useState<PlateLayout | null>(null);
  const [settling, setSettling] = useState(false);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [pan, setPan] = useState<Point | null>(null);
  const [svg, setSvg] = useState<SVGSVGElement | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const laidOut = useRef(false);
  const drag = useRef<Point | null>(null);
  const lastStep = useRef(0);
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

  const scene = useMemo(() => (layout ? buildScene(layout) : null), [layout]);

  const free: Box = { ...base, x1: base.x1 - sheet };
  const scale = scene ? fitScale(base.x1 - base.x0, scene.width) : 1;
  const k = scale * ZOOMS[zoomIndex]!;
  const home = scene ? homeOrigin(scene.bounds, base, k) : { x: 0, y: 0 };
  const origin = pan ?? home;
  const centre = { x: (free.x0 + free.x1) / 2, y: (free.y0 + free.y1) / 2 };

  const moveTo = (next: Point) => scene && setPan(clampOrigin(scene.bounds, free, k, next));
  const zoomTo = (index: number, anchor: Point) => {
    if (!scene || index < 0 || index >= ZOOMS.length) return;
    const nextK = scale * ZOOMS[index]!;
    setZoomIndex(index);
    setPan(clampOrigin(scene.bounds, free, nextK, zoomAround(origin, k, nextK, anchor)));
  };
  const reveal = (box: Box) => {
    const next = revealBox(origin, k, free, box);
    if (next.x !== origin.x || next.y !== origin.y) moveTo(next);
  };

  // A new filters island width is a new Fit area, so the view refits.
  useEffect(() => setPan(null), [base.x0]);
  useEffect(() => {
    const object = scene?.objects.find((o) => o.id === revealId);
    if (object) reveal(object.box);
    // Only a new selection or sheet width moves the view; every other render keeps it where the user left it.
  }, [revealId, sheet]);

  // React attaches wheel listeners as passive, and Ctrl + wheel must not zoom the page.
  useEffect(() => {
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!e.ctrlKey && !e.metaKey) return moveTo({ x: origin.x + e.deltaX / k, y: origin.y + e.deltaY / k });
      const now = performance.now();
      if (now - lastStep.current < STEP_MS) return;
      lastStep.current = now;
      const box = svg.getBoundingClientRect();
      zoomTo(zoomIndex + (e.deltaY < 0 ? 1 : -1), { x: e.clientX - box.left, y: e.clientY - box.top });
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  });

  if (scene && canvas.width > 0 && isRefused(scale)) {
    return (
      <div className="absolute" style={{ left: base.x0, top: base.y0 }}>
        <FitMessage count={concepts.length} scale={scale} floor={FIT_FLOOR} available={base.x1 - base.x0} />
      </div>
    );
  }

  const labels = new Map(layout?.nodes.map((n) => [n.id, `${n.designator} ${n.title}`]));
  const view = viewFor(canvas, k, origin);
  const dragBy = (e: PointerEvent<SVGSVGElement>) => {
    if (!drag.current) return;
    moveTo({ x: origin.x - (e.clientX - drag.current.x) / k, y: origin.y - (e.clientY - drag.current.y) / k });
    drag.current = { x: e.clientX, y: e.clientY };
  };

  return (
    <div ref={container} className="absolute inset-0" data-settling={settling || undefined}>
      {scene && canvas.width > 0 && (
        <svg
          ref={setSvg}
          className="plates absolute inset-0 block size-full cursor-grab touch-none active:cursor-grabbing"
          data-testid="plates"
          data-fit-scale={scale.toFixed(3)}
          data-projected-width={Math.round(scene.width)}
          viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
          role="group"
          aria-label={`Concepts on plates by layer: ${LAYERS.join(", ")}`}
          onPointerDown={(e) => {
            if (e.button !== 0 || (e.target as Element).closest(".obj, .wire")) return;
            drag.current = { x: e.clientX, y: e.clientY };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={dragBy}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
        >
          <defs>
            {MARKER_CODES.map((code) => (
              <marker key={code} id={`m-${code}`} viewBox="0 0 10 10" refX={9} refY={5} markerWidth={9} markerHeight={9} markerUnits="userSpaceOnUse" orient="auto">
                <path d="M0,0 L10,5 L0,10 z" style={{ fill: wireStyle(code === "other" ? null : code).stroke }} />
              </marker>
            ))}
          </defs>
          {scene.plates.map((plate) => (
            <g
              key={plate.layer}
              data-plate={plate.layer}
              style={layerStyle(plate.layer)}
              role="img"
              aria-label={`${plate.layer} layer, ${plate.shown} ${plate.shown === 1 ? "concept" : "concepts"} shown. ${MEANING.get(plate.layer)}`}
            >
              <polygon className="plate-face" points={plate.corners.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ")} />
              <use className="pic" href={`#${plate.layer}`} x={plate.mark.at.x - GROUND.x} y={plate.mark.at.y - GROUND.y} width={PICTOGRAM_PX} height={PICTOGRAM_PX} />
              <text className="llab" x={plate.mark.at.x} y={plate.mark.at.y + LABEL_OFFSET + 11} textAnchor="middle">
                {plate.layer.toUpperCase()} <tspan className="count">{plate.shown} shown</tspan>
              </text>
              {plate.shown === 0 && (
                <text className="pempty" x={plate.emptyAt.x} y={plate.emptyAt.y} textAnchor="middle">
                  no concepts shown
                </text>
              )}
            </g>
          ))}
          <g className="wires">
            {scene.wires.map((wire) => (
              <Wire key={wire.id} wire={wire} from={labels.get(wire.source) ?? wire.source} to={labels.get(wire.target) ?? wire.target} targetProps={targetProps} />
            ))}
          </g>
          <g>
            {scene.objects.map((object) => (
              <ConceptMark key={object.id} object={object} onOpen={onOpen} onFocus={reveal} />
            ))}
          </g>
          <g className="chips" aria-hidden="true">
            {scene.wires.map((wire) => (
              <g key={wire.id} data-chip={wire.id}>
                <rect x={wire.chip.box.x0} y={wire.chip.box.y0} width={wire.chip.box.x1 - wire.chip.box.x0} height={wire.chip.box.y1 - wire.chip.box.y0} />
                <text textAnchor="middle">
                  {wire.chip.lines.map((line, i) => (
                    <tspan key={i} x={wire.chip.at.x} y={wire.chip.box.y0 + 2 + 12 + i * LINE_HEIGHT}>
                      {line}
                    </tspan>
                  ))}
                </text>
              </g>
            ))}
          </g>
        </svg>
      )}
      <div role="group" aria-label="Zoom" className="absolute bottom-4 z-10 flex items-center gap-1 rounded-2xl border border-line bg-panel p-1 shadow-lg" style={{ right: 16 + sheet }}>
        <button type="button" className="zoom-btn" aria-label="Zoom out" disabled={zoomIndex === 0} onClick={() => zoomTo(zoomIndex - 1, centre)}>
          −
        </button>
        <output data-testid="zoom-value" className="min-w-12 text-center text-[13px] tabular-nums text-ink-muted">
          {Math.round(k * 100)} %
        </output>
        <button type="button" className="zoom-btn" aria-label="Zoom in" disabled={zoomIndex === ZOOMS.length - 1} onClick={() => zoomTo(zoomIndex + 1, centre)}>
          +
        </button>
        <button
          type="button"
          className="zoom-btn px-2.5"
          disabled={zoomIndex === 0 && pan === null}
          onClick={() => {
            setZoomIndex(0);
            setPan(null);
          }}
        >
          Fit
        </button>
      </div>
      <RelationPopover open={open} container={container} />
    </div>
  );
}
