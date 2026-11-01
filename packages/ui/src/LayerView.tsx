import { LAYERS, PICTOGRAMS, type Concept } from "@arch-mind/rules/model";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { ConceptList } from "./ConceptList.tsx";
import { FitMessage } from "./FitMessage.tsx";
import { layoutConcepts, type PlateLayout, type Point } from "./layout.ts";
import { PictogramDefs } from "./pictogram-art.tsx";
import {
  FIT_FLOOR,
  GROUND,
  LABEL_OFFSET,
  LINE_HEIGHT,
  PICTOGRAM_PX,
  ZOOMS,
  buildScene,
  centreOf,
  fitScale,
  followBox,
  isRefused,
  viewFor,
  type SceneObject,
  type SceneWire,
} from "./plates.ts";
import { RelationPopover, useRelationPopover, type RelationInfo, type RelationTargetProps } from "./Popover.tsx";
import { wireCode, wireStyle } from "./wire-code.ts";

const SETTLE_MS = 320;
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

function ConceptMark({ object, onOpen, onFocus }: { object: SceneObject; onOpen: OpenConcept; onFocus: (o: SceneObject) => void }) {
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
      onFocus={() => onFocus(object)}
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
  boardWidth,
  onOpen,
  onMeasure,
}: {
  concepts: Concept[];
  boardWidth: number;
  onOpen: OpenConcept;
  onMeasure: (needed: number) => void;
}) {
  const [layout, setLayout] = useState<PlateLayout | null>(null);
  const [settling, setSettling] = useState(false);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [centre, setCentre] = useState<Point | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const laidOut = useRef(false);
  const drag = useRef<Point | null>(null);
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
  useEffect(() => {
    if (scene) onMeasure(scene.width);
  }, [scene, onMeasure]);

  const scale = scene ? fitScale(boardWidth, scene.width) : 1;
  const zoom = ZOOMS[zoomIndex]!;
  const view = scene ? viewFor(scene.bounds, zoom, centre ?? centreOf(scene.bounds)) : null;

  const follow = useCallback(
    (object: SceneObject) => {
      if (!scene || !view || zoom === 1) return;
      const next = followBox(view, object.box);
      if (next.x !== view.x + view.width / 2 || next.y !== view.y + view.height / 2) setCentre(next);
    },
    [scene, view, zoom],
  );

  if (scene && boardWidth > 0 && isRefused(scale)) {
    return <FitMessage count={concepts.length} scale={scale} floor={FIT_FLOOR} available={boardWidth} />;
  }

  const labels = new Map(layout?.nodes.map((n) => [n.id, `${n.designator} ${n.title}`]));
  const pan = (e: PointerEvent<SVGSVGElement>) => {
    if (!drag.current || !view) return;
    const k = scale * zoom;
    setCentre({ x: view.x + view.width / 2 - (e.clientX - drag.current.x) / k, y: view.y + view.height / 2 - (e.clientY - drag.current.y) / k });
    drag.current = { x: e.clientX, y: e.clientY };
  };

  return (
    <div ref={container} className="relative" data-settling={settling || undefined}>
      <div className="flex items-center justify-end gap-1 px-3 pt-2" role="group" aria-label="Zoom">
        <button type="button" className="zoom-btn" aria-label="Zoom out" disabled={zoomIndex === 0} onClick={() => setZoomIndex(zoomIndex - 1)}>
          −
        </button>
        <output data-testid="zoom-value" className="min-w-12 text-center text-[13px] tabular-nums text-ink-muted">
          {Math.round(scale * zoom * 100)} %
        </output>
        <button type="button" className="zoom-btn" aria-label="Zoom in" disabled={zoomIndex === ZOOMS.length - 1} onClick={() => setZoomIndex(zoomIndex + 1)}>
          +
        </button>
        <button
          type="button"
          className="zoom-btn px-2.5"
          disabled={zoomIndex === 0}
          onClick={() => {
            setZoomIndex(0);
            setCentre(null);
          }}
        >
          Fit
        </button>
      </div>
      {scene && view && (
        <svg
          className="plates mx-auto block touch-none"
          data-testid="plates"
          data-fit-scale={scale.toFixed(3)}
          data-projected-width={Math.round(scene.width)}
          width={scene.width * scale}
          height={scene.height * scale}
          viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
          role="group"
          aria-label={`Concepts on plates by layer: ${LAYERS.join(", ")}`}
          onPointerDown={(e) => {
            if (zoom === 1 || (e.target as Element).closest(".obj, .wire")) return;
            drag.current = { x: e.clientX, y: e.clientY };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={pan}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
        >
          <PictogramDefs />
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
              <ConceptMark key={object.id} object={object} onOpen={onOpen} onFocus={follow} />
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
      {layout && <ConceptList layout={layout} onOpen={onOpen} />}
      <RelationPopover open={open} container={container} />
    </div>
  );
}
