import { LAYERS, PICTOGRAMS, type Concept } from "@arch-mind/rules/model";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { MAX_ZOOM, createGlide, frameBox, prefersReducedMotion, stepZoom, wheelZoom, type Cam } from "./camera.ts";
import { FitMessage } from "./FitMessage.tsx";
import { layoutConcepts, type PlateLayout, type Point } from "./layout.ts";
import type { Neighbourhood } from "./neighbourhood.ts";
import {
  FIT_FLOOR,
  GROUND,
  LABEL_OFFSET,
  LINE_HEIGHT,
  PICTOGRAM_PX,
  buildScene,
  clampOrigin,
  fitScale,
  homeOrigin,
  isRefused,
  revealBox,
  union,
  viewFor,
  zoomAround,
  type Box,
  type SceneObject,
  type SceneWire,
} from "./plates.ts";
import { wireProminence as prominenceOfWire, type Prominence, type WireKind } from "./prominence.ts";
import { RelationPopover, useRelationPopover, type RelationInfo, type RelationTargetProps } from "./Popover.tsx";
import { wireCode, wireStyle } from "./wire-code.ts";

const SETTLE_MS = 320;
const CLICK_SLOP = 4;
// A released drag keeps sliding for about this long at its release speed; a harder fling is capped so it stays on the board.
const INERTIA_SECONDS = 0.18;
const MAX_FLING_PX_PER_MS = 3;
const SAMPLE_MS = 100;
const STALE_RELEASE_MS = 80;
const MARKER_CODES = ["requires", "complements", "contains", "alternative", "other"] as const;
const MEANING = new Map(PICTOGRAMS.map((p) => [p.id, p.meaning]));

export type OpenConcept = (id: string, opener: HTMLElement | SVGElement) => void;

const layerStyle = (layer: string): CSSProperties => ({ "--k": `var(--layer-${layer})` }) as CSSProperties;
const polyline = (points: Point[]) => points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
const pathLength = (points: Point[]) => points.reduce((sum, p, i) => (i === 0 ? 0 : sum + Math.hypot(p.x - points[i - 1]!.x, p.y - points[i - 1]!.y)), 0);
const markerId = (type: string) => `m-${wireCode(type) ?? "other"}`;

function Wire({
  wire,
  from,
  to,
  prominence,
  draw,
  length,
  targetProps,
}: {
  wire: SceneWire;
  from: string;
  to: string;
  prominence: Prominence | undefined;
  draw: string | undefined;
  length: number;
  targetProps: (key: string, relations: RelationInfo[]) => RelationTargetProps;
}) {
  const props = targetProps(wire.id, [{ type: wire.label, from, to, source: wire.citation, explanation: wire.explanation }]);
  const d = polyline(wire.path);
  return (
    <g
      className="wire"
      data-testid="wire"
      data-relation-target
      data-state={prominence}
      data-draw={draw}
      style={{ "--len": length } as CSSProperties}
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

function ConceptMark({ object, prominence, onOpen, onFocus }: { object: SceneObject; prominence: Prominence | undefined; onOpen: OpenConcept; onFocus: (box: Box) => void }) {
  const meaning = MEANING.get(object.pictogram) ?? object.pictogram;
  return (
    <g
      className="obj"
      data-testid="concept"
      data-id={object.id}
      data-pictogram={object.pictogram}
      data-state={prominence}
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
      <ellipse className="halo" rx={44} ry={22} cy={-4} />
      <g className="lift">
        <use className="pic" href={`#${object.pictogram}`} x={-GROUND.x} y={-GROUND.y} width={PICTOGRAM_PX} height={PICTOGRAM_PX} />
      </g>
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

interface Fling {
  x: number;
  y: number;
  at: number;
}

export function LayerView({
  concepts,
  names,
  canvas,
  base,
  sheet,
  hood,
  wireType,
  away,
  onOpen,
  onClear,
  onNarrow,
  onFocusConcept,
}: {
  concepts: Concept[];
  names: Map<string, string>;
  canvas: { width: number; height: number };
  // The part of the canvas no island covers, and how much of its right side the open detail sheet takes.
  base: Box;
  sheet: number;
  hood: Neighbourhood | null;
  wireType: WireKind | null;
  // Review hides the plates and their zoom island, but keeps the camera where the user left it.
  away: boolean;
  onOpen: OpenConcept;
  onClear: () => void;
  onNarrow: () => void;
  onFocusConcept: () => void;
}) {
  const [layout, setLayout] = useState<PlateLayout | null>(null);
  const [settling, setSettling] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point | null>(null);
  const [svg, setSvg] = useState<SVGSVGElement | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const world = useRef<SVGGElement>(null);
  const laidOut = useRef(false);
  const drag = useRef<{ moved: number; samples: Fling[] } | null>(null);
  // Only camera moves the user or a selection asks for glide; a new Fit scale from a resize or a re-laid-out scene lands at once, so wires never slide under a pointer that is already on them.
  const gliding = useRef(false);
  const sent = useRef<Cam | null>(null);
  const before = useRef<{ zoom: number; pan: Point | null } | null>(null);
  const drawn = useRef<{ id: string | null; turn: number }>({ id: null, turn: 0 });
  const { open, targetProps } = useRelationPopover(container);

  const glide = useMemo(
    () =>
      createGlide((visual, target) => {
        const group = world.current;
        if (!group) return;
        const r = visual.k / target.k;
        if (r === 1 && visual.x === target.x && visual.y === target.y) group.removeAttribute("transform");
        else group.setAttribute("transform", `translate(${target.x - visual.x * r} ${target.y - visual.y * r}) scale(${r})`);
      }),
    [],
  );
  useEffect(() => () => glide.stop(), [glide]);

  useEffect(() => {
    let current = true;
    layoutConcepts(concepts, names).then((l) => current && setLayout(l));
    return () => {
      current = false;
    };
  }, [concepts, names]);

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
  const k = scale * zoom;
  const home = scene ? homeOrigin(scene.bounds, base, k) : { x: 0, y: 0 };
  const origin = pan ?? home;
  const centre = { x: (free.x0 + free.x1) / 2, y: (free.y0 + free.y1) / 2 };

  // Several wheel events can arrive before React renders, so the latest camera is kept here and not read back from state.
  const cam = useRef({ zoom, pan });
  cam.current = { zoom, pan };
  const originFor = (z: number, p: Point | null) => p ?? homeOrigin(scene!.bounds, base, scale * z);

  const setCamera = (z: number, p: Point | null, snap = false) => {
    cam.current = { zoom: z, pan: p };
    gliding.current = !snap;
    setZoom(z);
    setPan(p);
  };
  const moveTo = (next: Point, snap = false) => scene && setCamera(cam.current.zoom, clampOrigin(scene.bounds, free, scale * cam.current.zoom, next), snap);
  const zoomTo = (target: number, anchor: Point) => {
    if (!scene) return;
    const z = Math.max(1, Math.min(MAX_ZOOM, target));
    const k0 = scale * cam.current.zoom;
    const k1 = scale * z;
    setCamera(z, clampOrigin(scene.bounds, free, k1, zoomAround(originFor(cam.current.zoom, cam.current.pan), k0, k1, anchor)));
  };
  const reveal = (box: Box) => {
    const o = originFor(cam.current.zoom, cam.current.pan);
    const next = revealBox(o, scale * cam.current.zoom, free, box);
    // Focus moves as fast as the user tabs, so the view follows at once instead of gliding behind the keys.
    if (next.x !== o.x || next.y !== o.y) moveTo(next, true);
  };

  useLayoutEffect(() => {
    const target = { k, x: origin.x, y: origin.y };
    const previous = sent.current;
    if (previous && previous.k === target.k && previous.x === target.x && previous.y === target.y) {
      gliding.current = false;
      return;
    }
    sent.current = target;
    glide.to(target, !gliding.current);
    gliding.current = false;
  });

  // A new filters island width is a new Fit area, so the view refits.
  useEffect(() => setCamera(cam.current.zoom, null), [base.x0]);

  useEffect(() => {
    if (!scene) return;
    if (!hood) {
      const back = before.current;
      before.current = null;
      if (back) setCamera(back.zoom, back.pan);
      return;
    }
    const ids = new Set([hood.id, ...hood.connected]);
    const boxes = scene.objects.filter((o) => ids.has(o.id)).map((o) => o.box);
    const selected = scene.objects.find((o) => o.id === hood.id);
    if (!selected) return;
    before.current ??= { ...cam.current };
    const framed = frameBox(union(boxes), free, scale, selected.box);
    setCamera(framed.zoom, clampOrigin(scene.bounds, free, scale * framed.zoom, framed.origin));
    // Only a new selection, drawer width, scene or Fit area moves the view; every other render keeps it where the user left it.
  }, [hood?.id, sheet, scene, base.x0]);

  // React attaches wheel listeners as passive, and Ctrl + wheel must not zoom the page.
  useEffect(() => {
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { zoom: z, pan: p } = cam.current;
      if (!e.ctrlKey && !e.metaKey) {
        const o = originFor(z, p);
        return moveTo({ x: o.x + e.deltaX / (scale * z), y: o.y + e.deltaY / (scale * z) }, true);
      }
      const box = svg.getBoundingClientRect();
      zoomTo(wheelZoom(z, e.deltaY, e.deltaMode), { x: e.clientX - box.left, y: e.clientY - box.top });
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  });

  if (scene && canvas.width > 0 && isRefused(scale)) {
    return (
      <div className="absolute" style={{ left: base.x0, top: base.y0 }}>
        <FitMessage count={concepts.length} scale={scale} floor={FIT_FLOOR} available={base.x1 - base.x0} onNarrow={onNarrow} onFocusConcept={onFocusConcept} />
      </div>
    );
  }

  const labels = new Map(layout?.nodes.map((n) => [n.id, `${n.designator} ${n.title}`]));
  const view = viewFor(canvas, k, origin);

  const near = hood ? new Set([hood.id, ...hood.connected]) : null;
  const objectProminence = (id: string): Prominence | undefined => (!hood || !near ? undefined : id === hood.id ? "selected" : near.has(id) ? "near" : "far");
  const wireProminence = (w: SceneWire) => prominenceOfWire(hood, wireType, w);
  const plateProminence = (layer: string): Prominence | undefined =>
    !near ? undefined : scene?.objects.some((o) => o.layer === layer && near.has(o.id)) ? "near" : "far";

  // Alternating the animation lets the draw-on restart when the selection moves between concepts that share a wire.
  if (drawn.current.id !== (hood?.id ?? null)) drawn.current = { id: hood?.id ?? null, turn: drawn.current.turn + 1 };
  const drawName = (w: SceneWire) => (hood && wireProminence(w) === "near" && !prefersReducedMotion() ? (drawn.current.turn % 2 === 0 ? "a" : "b") : undefined);

  const dragBy = (e: PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    const last = d.samples.at(-1)!;
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    d.moved += Math.abs(dx) + Math.abs(dy);
    const o = originFor(cam.current.zoom, cam.current.pan);
    moveTo({ x: o.x - dx / k, y: o.y - dy / k }, true);
    d.samples = [...d.samples.filter((s) => e.timeStamp - s.at <= SAMPLE_MS), { x: e.clientX, y: e.clientY, at: e.timeStamp }];
  };
  const release = (e: PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved < CLICK_SLOP) return onClear();
    const first = d.samples[0]!;
    const last = d.samples.at(-1)!;
    if (prefersReducedMotion() || e.timeStamp - last.at > STALE_RELEASE_MS) return;
    const span = Math.max(16, last.at - first.at);
    const speed = (from: number, to: number) => Math.max(-MAX_FLING_PX_PER_MS, Math.min(MAX_FLING_PX_PER_MS, (to - from) / span));
    const vx = -speed(first.x, last.x) / k;
    const vy = -speed(first.y, last.y) / k;
    const o = originFor(cam.current.zoom, cam.current.pan);
    glide.kick(vx * 1000, vy * 1000);
    moveTo({ x: o.x + vx * 1000 * INERTIA_SECONDS, y: o.y + vy * 1000 * INERTIA_SECONDS });
  };

  return (
    <div ref={container} className="stage absolute inset-0" data-settling={settling || undefined} data-away={away || undefined} inert={away}>
      {scene && canvas.width > 0 && (
        <svg
          ref={setSvg}
          className="plates absolute inset-0 block size-full cursor-grab touch-none active:cursor-grabbing"
          data-testid="plates"
          data-fit-scale={scale.toFixed(3)}
          data-projected-width={Math.round(scene.width)}
          data-selection={hood?.id}
          viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
          role="group"
          aria-label={`Concepts on plates by layer: ${LAYERS.join(", ")}`}
          onPointerDown={(e) => {
            if (e.button !== 0 || (e.target as Element).closest(".obj, .wire")) return;
            drag.current = { moved: 0, samples: [{ x: e.clientX, y: e.clientY, at: e.timeStamp }] };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={dragBy}
          onPointerUp={release}
          onPointerCancel={() => (drag.current = null)}
        >
          <defs>
            {MARKER_CODES.map((code) => (
              <marker key={code} id={`m-${code}`} viewBox="0 0 10 10" refX={9} refY={5} markerWidth={9} markerHeight={9} markerUnits="userSpaceOnUse" orient="auto">
                <path d="M0,0 L10,5 L0,10 z" style={{ fill: wireStyle(code === "other" ? null : code).stroke }} />
              </marker>
            ))}
          </defs>
          <g ref={world}>
            {scene.plates.map((plate) => (
              <g
                key={plate.layer}
                data-plate={plate.layer}
                data-state={plateProminence(plate.layer)}
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
                <Wire
                  key={wire.id}
                  wire={wire}
                  from={labels.get(wire.source) ?? wire.source}
                  to={labels.get(wire.target) ?? wire.target}
                  prominence={wireProminence(wire)}
                  draw={drawName(wire)}
                  length={pathLength(wire.path) * k * 1.5 + 16}
                  targetProps={targetProps}
                />
              ))}
            </g>
            <g>
              {scene.objects.map((object) => (
                <ConceptMark key={object.id} object={object} prominence={objectProminence(object.id)} onOpen={onOpen} onFocus={reveal} />
              ))}
            </g>
            <g className="chips" aria-hidden="true">
              {scene.wires.map((wire) => (
                <g key={wire.id} data-chip={wire.id} data-state={wireProminence(wire)}>
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
          </g>
        </svg>
      )}
      <div role="group" aria-label="Zoom" className="island absolute bottom-4 z-10 flex items-center gap-1 rounded-2xl p-1" style={{ right: 16 + sheet }}>
        <button type="button" className="press zoom-btn" aria-label="Zoom out" disabled={zoom <= 1} onClick={() => zoomTo(stepZoom(zoom, -1), centre)}>
          −
        </button>
        <output data-testid="zoom-value" className="min-w-12 text-center text-[13px] tabular-nums text-ink-muted">
          {Math.round(k * 100)} %
        </output>
        <button type="button" className="press zoom-btn" aria-label="Zoom in" disabled={zoom >= MAX_ZOOM} onClick={() => zoomTo(stepZoom(zoom, 1), centre)}>
          +
        </button>
        <button type="button" className="press zoom-btn px-2.5" disabled={zoom === 1 && pan === null} onClick={() => setCamera(1, null)}>
          Fit
        </button>
      </div>
      <RelationPopover open={open} container={container} />
    </div>
  );
}
