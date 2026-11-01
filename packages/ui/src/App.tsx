import type { Concept, FileProblem, Layer } from "@arch-mind/rules/model";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConceptDetail, SHEET_WIDTH } from "./ConceptDetail.tsx";
import { ConceptList } from "./ConceptList.tsx";
import { NO_FILTERS, filterConcepts, type Filters } from "./filter.ts";
import { LayerView } from "./LayerView.tsx";
import { MatrixView } from "./MatrixView.tsx";
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
  const board = useRef<HTMLDivElement>(null);
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

  return (
    <main className="fixed inset-0 overflow-hidden">
      <svg width="0" height="0" aria-hidden="true" className="absolute">
        <PictogramDefs />
      </svg>
      <div ref={board} className="canvas-dots absolute inset-0" data-testid="board" data-view={view}>
        {data && view === "layers" && <LayerView concepts={shown} canvas={canvas} base={base} sheet={sheet} revealId={selected} onOpen={open} />}
        {data && view === "matrix" && (
          <div className="absolute inset-0 overflow-auto" style={scroller}>
            <MatrixView concepts={shown} boardWidth={base.x1 - base.x0} onOpen={open} />
          </div>
        )}
        {view === "review" && (
          <div className="absolute inset-0 overflow-auto" style={scroller}>
            <ReviewScreen titles={titles} onOpenConcept={open} />
          </div>
        )}
      </div>

      <div className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-2xl border border-line bg-panel p-1.5 shadow-lg">
        <h1 className="px-2 text-[15px] font-semibold tracking-tight">arch-mind</h1>
        <div role="group" aria-label="View" className="flex gap-1 rounded-xl bg-canvas p-1">
          {(["layers", "matrix", "review"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`rounded-lg px-3 py-1 text-[13px] ${view === v ? "bg-accent text-on-accent" : "text-ink-muted hover:text-ink"}`}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>
      </div>

      {data && (view !== "review" || data.problems.length > 0) && (
        <div className="absolute right-4 top-4 z-10 flex items-center gap-4 rounded-2xl border border-line bg-panel px-4 py-2.5 shadow-lg">
          {view !== "review" && (
            <p className="text-[13px] tabular-nums text-ink-muted" aria-live="polite">
              {`${shown.length} of ${data.concepts.length} concepts shown`}
            </p>
          )}
          {data.problems.length > 0 && <ProblemsDisclosure problems={data.problems} />}
        </div>
      )}

      {error && (
        <p role="alert" className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-2xl border border-line bg-panel px-4 py-2.5 text-correction shadow-lg">
          Could not load concepts: {error}
        </p>
      )}

      {data && (
        <Sidebar facets={data.facets} filters={filters} onChange={setFilters} layerCounts={layerCounts} open={filtersOpen} onToggle={() => setFiltersOpen(!filtersOpen)}>
          {view === "layers" && <ConceptList concepts={shown} onOpen={open} />}
        </Sidebar>
      )}
      {data && <WireLegend />}
      {selected && <ConceptDetail id={selected} titles={titles} onClose={close} />}
    </main>
  );
}
