import type { MouseEvent } from "react";
import type { Concept, FileProblem, Layer } from "@arch-mind/rules/model";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ConceptDetail, SHEET_WIDTH } from "./ConceptDetail.tsx";
import { ConceptList } from "./ConceptList.tsx";
import { NO_FILTERS, filterConcepts, type Filters } from "./filter.ts";
import { Finder } from "./Finder.tsx";
import { focusedConcepts } from "./focus.ts";
import { FocusPill } from "./FocusPill.tsx";
import { clearHidingFacets } from "./finder.ts";
import { designators } from "./layout.ts";
import { LayerView } from "./LayerView.tsx";
import { MatrixView } from "./MatrixView.tsx";
import { neighbourhood } from "./neighbourhood.ts";
import { PictogramDefs } from "./pictogram-art.tsx";
import type { WireKind } from "./prominence.ts";
import type { Box } from "./plates.ts";
import { ReviewScreen } from "./ReviewScreen.tsx";
import { FILTERS_WIDTH, ProblemsDisclosure, Sidebar, WireLegend, type FacetCatalog } from "./Sidebar.tsx";

interface Loaded {
  concepts: Concept[];
  problems: FileProblem[];
  facets: FacetCatalog;
}

type View = "layers" | "matrix" | "review";

const VIEW_LABELS: Record<View, string> = { layers: "Layers", matrix: "Matrix", review: "Review" };
const MARGIN = 16;
// Below the top islands.
const TOP_INSET = 72;
// The legend and zoom islands sit on the bottom edge, so the free area stops above them like it does below the top islands.
const BOTTOM_INSET = 72;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export function App() {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [view, setView] = useState<View>("layers");
  const [selected, setSelected] = useState<string | null>(null);
  const [wireType, setWireType] = useState<WireKind | null>(null);
  const [finderOpen, setFinderOpen] = useState(false);
  // Focus is a state of the layer view only: it lives here, in memory, and ends with the selection.
  const [focused, setFocused] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [canvas, setCanvas] = useState({ width: 0, height: 0 });
  // The plates stay mounted behind Review only once they have been shown, so opening Review first never pays for a layout.
  const [platesShown, setPlatesShown] = useState(false);
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);
  const board = useRef<HTMLDivElement>(null);
  const switcher = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | SVGElement | null>(null);
  const finderFrom = useRef<HTMLElement | SVGElement | null>(null);
  const focusOnChoose = useRef(false);

  useEffect(() => {
    Promise.all([
      getJson<{ concepts: Concept[]; problems: FileProblem[] }>("/api/concepts"),
      getJson<FacetCatalog>("/api/facets"),
    ]).then(
      ([loaded, facets]) => setData({ ...loaded, facets }),
      (e: Error) => setError(e.message),
    );
  }, []);

  useEffect(() => {
    const el = board.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setCanvas({ width: entry?.contentRect.width ?? 0, height: entry?.contentRect.height ?? 0 }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const shown = useMemo(() => (data ? filterConcepts(data.concepts, filters) : []), [data, filters]);
  const titles = useMemo(() => new Map(data?.concepts.map((c) => [c.id, c.title]) ?? []), [data]);
  const layerCounts = useMemo(() => {
    const counts: Record<Layer, number> = { client: 0, network: 0, server: 0, data: 0 };
    for (const c of data?.concepts ?? []) counts[c.layer]++;
    return counts;
  }, [data]);

  useEffect(() => {
    if (data && view === "layers") setPlatesShown(true);
  }, [data, view]);

  const hood = useMemo(() => (selected ? neighbourhood(shown, selected) : null), [shown, selected]);
  const focusSet = useMemo(() => (focused && selected ? focusedConcepts(shown, selected) : null), [focused, shown, selected]);
  const focusActive = focusSet !== null && focusSet.length > 0;
  // The drawer can name a concept the filters hide, so it falls back to the numbering of the whole store.
  const names = useMemo(() => new Map([...designators(data?.concepts ?? []), ...designators(shown)]), [data, shown]);

  // The web font changes the button widths after first paint, so the thumb follows the switch's size too.
  useLayoutEffect(() => {
    const el = switcher.current;
    if (!el) return;
    const measure = () => {
      const active = el.querySelector<HTMLElement>('[aria-pressed="true"]');
      if (active) setThumb({ left: active.offsetLeft, width: active.offsetWidth });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [view]);

  const open = useCallback((id: string, from: HTMLElement | SVGElement) => {
    opener.current = from;
    setSelected(id);
  }, []);
  const close = useCallback(() => {
    setSelected(null);
    const from = opener.current;
    opener.current = null;
    if (from?.isConnected) from.focus();
  }, []);

  const inReview = view === "review";
  const startFocus = useCallback(() => {
    setFocused(true);
    setView((v) => (v === "matrix" ? "layers" : v));
  }, []);
  const exitFocus = useCallback(() => setFocused(false), []);
  // Focus is a state of the layer view, so leaving it for the matrix or Review ends it.
  const changeView = (next: View) => {
    if (next !== "layers") setFocused(false);
    setView(next);
  };

  // Clearing the selection, or filters that hide the focused concept, leave focus; it must not resume with the next selection.
  useEffect(() => {
    if (focused && !focusActive) setFocused(false);
  }, [focused, focusActive]);

  const wasFocused = useRef(false);
  const focusName = selected ? `${names.get(selected) ?? ""} ${titles.get(selected) ?? selected}`.trim() : "";
  useEffect(() => {
    if (focusActive) setAnnouncement(`Focused on ${focusName}`);
    else if (wasFocused.current) setAnnouncement("Focus ended");
    wasFocused.current = focusActive;
    // Moving focus to another concept is not a start or an end, so the name stays out of the dependencies.
  }, [focusActive]);
  const closeFinder = useCallback(() => {
    setFinderOpen(false);
    focusOnChoose.current = false;
    const from = finderFrom.current;
    finderFrom.current = null;
    if (from?.isConnected) from.focus();
  }, []);
  const openFinder = (forFocus: boolean) => {
    const active = document.activeElement;
    finderFrom.current = active instanceof HTMLElement || active instanceof SVGElement ? active : null;
    focusOnChoose.current = forFocus;
    setFinderOpen(true);
  };
  const narrowFilters = () => {
    setFiltersOpen(true);
    document.querySelector<HTMLElement>('aside[aria-label="Filters"] button')?.focus();
  };

  const choose = (id: string) => {
    const chosen = data?.concepts.find((c) => c.id === id);
    if (!chosen) return;
    opener.current = finderFrom.current?.isConnected ? finderFrom.current : null;
    finderFrom.current = null;
    setFilters(clearHidingFacets(chosen, filters));
    setSelected(id);
    setFinderOpen(false);
    if (focusOnChoose.current) startFocus();
    focusOnChoose.current = false;
    // A drawer already open on this concept would not move focus by itself.
    if (id === selected) document.querySelector<HTMLElement>('[data-testid="concept-detail"]')?.focus();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        if (inReview) return;
        e.preventDefault();
        if (finderOpen) return closeFinder();
        openFinder(false);
      } else if (e.key === "Escape" && !finderOpen && !e.defaultPrevented) {
        if (focused) exitFocus();
        else if (!selected) setWireType(null);
      } else if (e.key.toLowerCase() === "f" && !e.ctrlKey && !e.metaKey && !e.altKey && selected && !inReview && !finderOpen && !(e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable]"))) {
        startFocus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // openFinder only writes refs and a setter, so a stale copy behaves the same.
  }, [closeFinder, exitFocus, startFocus, focused, inReview, finderOpen, selected]);

  // The part of the canvas the islands leave free. The detail sheet narrows it from the right without refitting the view.
  const base: Box = {
    x0: filtersOpen ? MARGIN + FILTERS_WIDTH + MARGIN : MARGIN,
    y0: TOP_INSET,
    x1: canvas.width - MARGIN,
    y1: canvas.height - BOTTOM_INSET,
  };
  const sheet = selected ? SHEET_WIDTH + MARGIN : 0;
  const scroller = { padding: `${base.y0}px ${MARGIN + sheet}px ${BOTTOM_INSET}px ${base.x0}px` };
  const clearOnEmpty = (e: MouseEvent<HTMLElement>) => e.target === e.currentTarget && selected && close();

  return (
    <main className="fixed inset-0 overflow-hidden">
      <svg width="0" height="0" aria-hidden="true" className="absolute">
        <PictogramDefs />
      </svg>
      <div ref={board} className="canvas-dots absolute inset-0" data-testid="board" data-view={view}>
        {data && (view === "layers" || (inReview && platesShown)) && <LayerView concepts={focusSet ?? shown} names={names} canvas={canvas} base={base} sheet={sheet} hood={hood} wireType={wireType} away={inReview} onOpen={open} onClear={close} onNarrow={narrowFilters} onFocusConcept={() => openFinder(true)} />}
        {data && view === "matrix" && (
          <div className="absolute inset-0 overflow-auto" style={scroller} onClick={clearOnEmpty}>
            <MatrixView concepts={shown} boardWidth={base.x1 - base.x0} hood={hood} wireType={wireType} onOpen={open} onNarrow={narrowFilters} onFocusConcept={() => openFinder(true)} />
          </div>
        )}
        {inReview && (
          <div className="absolute inset-0 overflow-auto" style={scroller}>
            <ReviewScreen titles={titles} onOpenConcept={open} />
          </div>
        )}
      </div>

      <div className="island absolute left-4 top-4 z-10 flex items-center gap-2 rounded-2xl p-1.5">
        <h1 className="px-2 text-[15px] font-semibold tracking-tight">arch-mind</h1>
        <div ref={switcher} role="group" aria-label="View" className="relative flex gap-1 rounded-xl bg-canvas p-1">
          {thumb && <span aria-hidden="true" className="thumb" style={{ left: thumb.left, width: thumb.width }} />}
          {(["layers", "matrix", "review"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => changeView(v)}
              className={`press relative rounded-lg px-3 py-1 text-[13px] ${view === v ? "text-on-accent" : "text-ink-muted hover:text-ink"}`}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>
      </div>

      {data && (view !== "review" || data.problems.length > 0) && (
        <div className="island absolute top-4 z-10 flex items-center gap-4 rounded-2xl px-4 py-2.5" style={{ right: MARGIN + sheet }}>
          {view !== "review" && (
            <p className="text-[13px] tabular-nums text-ink-muted" aria-live="polite">
              {`${shown.length} of ${data.concepts.length} concepts shown`}
            </p>
          )}
          {data.problems.length > 0 && <ProblemsDisclosure problems={data.problems} />}
        </div>
      )}

      {focusActive && <FocusPill designator={selected ? names.get(selected) ?? "" : ""} title={selected ? titles.get(selected) ?? selected : ""} sheet={sheet} onExit={exitFocus} />}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {error && (
        <p role="alert" className="island absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-2xl px-4 py-2.5 text-correction">
          Could not load concepts: {error}
        </p>
      )}

      {data && (
        <Sidebar facets={data.facets} filters={filters} onChange={setFilters} layerCounts={layerCounts} open={filtersOpen} onToggle={() => setFiltersOpen(!filtersOpen)} away={inReview}>
          {view === "layers" && <ConceptList concepts={shown} selected={selected} onOpen={open} />}
        </Sidebar>
      )}
      {data && <WireLegend away={inReview} active={wireType} onChange={setWireType} />}
      {finderOpen && data && <Finder concepts={data.concepts} onChoose={choose} onClose={closeFinder} />}
      {selected && data && <ConceptDetail id={selected} concepts={data.concepts} names={names} focused={focusActive} canFocus={!inReview} onSelect={setSelected} onToggleFocus={focusActive ? exitFocus : startFocus} onClose={close} />}
    </main>
  );
}
