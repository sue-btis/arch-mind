import type { MouseEvent } from "react";
import type { Concept, FileProblem, Layer } from "@arch-mind/rules/model";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ConceptDetail, SHEET_WIDTH } from "./ConceptDetail.tsx";
import { ConceptList } from "./ConceptList.tsx";
import { NO_FILTERS, filterConcepts, type Filters } from "./filter.ts";
import { designators } from "./layout.ts";
import { LayerView } from "./LayerView.tsx";
import { MatrixView } from "./MatrixView.tsx";
import { neighbourhood } from "./neighbourhood.ts";
import { PictogramDefs } from "./pictogram-art.tsx";
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
  const [canvas, setCanvas] = useState({ width: 0, height: 0 });
  // The plates stay mounted behind Review only once they have been shown, so opening Review first never pays for a layout.
  const [platesShown, setPlatesShown] = useState(false);
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);
  const board = useRef<HTMLDivElement>(null);
  const switcher = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | SVGElement | null>(null);

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
  const inReview = view === "review";

  return (
    <main className="fixed inset-0 overflow-hidden">
      <svg width="0" height="0" aria-hidden="true" className="absolute">
        <PictogramDefs />
      </svg>
      <div ref={board} className="canvas-dots absolute inset-0" data-testid="board" data-view={view}>
        {data && (view === "layers" || (inReview && platesShown)) && <LayerView concepts={shown} canvas={canvas} base={base} sheet={sheet} hood={hood} away={inReview} onOpen={open} onClear={close} />}
        {data && view === "matrix" && (
          <div className="absolute inset-0 overflow-auto" style={scroller} onClick={clearOnEmpty}>
            <MatrixView concepts={shown} boardWidth={base.x1 - base.x0} hood={hood} onOpen={open} />
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
              onClick={() => setView(v)}
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
      {data && <WireLegend away={inReview} />}
      {selected && data && <ConceptDetail id={selected} concepts={data.concepts} names={names} onSelect={setSelected} onClose={close} />}
    </main>
  );
}
