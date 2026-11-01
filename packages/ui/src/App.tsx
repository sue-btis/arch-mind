import type { Concept, FileProblem } from "@arch-mind/rules/model";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConceptDetail } from "./ConceptDetail.tsx";
import { NO_FILTERS, filterConcepts, type Filters } from "./filter.ts";
import { LayerView } from "./LayerView.tsx";
import { MatrixView } from "./MatrixView.tsx";
import { ReviewScreen } from "./ReviewScreen.tsx";
import { Sidebar, type FacetCatalog } from "./Sidebar.tsx";

interface Loaded {
  concepts: Concept[];
  problems: FileProblem[];
  facets: FacetCatalog;
}

type View = "layers" | "matrix" | "review";

const VIEW_LABELS: Record<View, string> = { layers: "Layers", matrix: "Matrix", review: "Review" };

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export function App() {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [view, setView] = useState<View>("layers");
  const [selected, setSelected] = useState<string | null>(null);
  const [boardWidth, setBoardWidth] = useState(0);
  const board = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);

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
    const observer = new ResizeObserver(([entry]) => setBoardWidth(entry?.contentRect.width ?? 0));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const shown = useMemo(() => (data ? filterConcepts(data.concepts, filters) : []), [data, filters]);
  const titles = useMemo(() => new Map(data?.concepts.map((c) => [c.id, c.title]) ?? []), [data]);

  const open = useCallback((id: string, from: HTMLElement) => {
    opener.current = from;
    setSelected(id);
  }, []);
  const close = useCallback(() => {
    setSelected(null);
    const from = opener.current;
    opener.current = null;
    if (from?.isConnected) from.focus();
  }, []);

  const relations = data?.concepts.reduce((n, c) => n + c.relations.length, 0) ?? 0;

  return (
    <main className="mx-auto flex max-w-[1366px] flex-col gap-3 p-4">
      <header className="flex items-baseline justify-between px-1">
        <h1 className="text-[15px] font-semibold tracking-tight">arch-mind</h1>
        <p className="text-[13px] text-ink-muted">
          {data ? `${data.concepts.length} concepts · ${relations} relations` : ""}
          {data && data.problems.length > 0 ? ` · ${data.problems.length} files could not be read` : ""}
        </p>
      </header>
      {error && <p role="alert">Could not load concepts: {error}</p>}
      <div className="flex items-start gap-3">
        {data && <Sidebar facets={data.facets} filters={filters} onChange={setFilters} problems={data.problems} />}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <div role="group" aria-label="View" className="flex gap-1 rounded-xl border border-line bg-panel p-1">
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
            <p className="text-[13px] text-ink-muted" aria-live="polite">
              {data && view !== "review" ? `${shown.length} of ${data.concepts.length} concepts shown` : ""}
            </p>
          </div>
          <div ref={board} hidden={view === "review"} className="border border-line bg-board" data-testid="board" data-view={view}>
            {data && view === "layers" && <LayerView concepts={shown} boardWidth={boardWidth} onOpen={open} />}
            {data && view === "matrix" && <MatrixView concepts={shown} boardWidth={boardWidth} onOpen={open} />}
          </div>
          {view === "review" && <ReviewScreen titles={titles} onOpenConcept={open} />}
        </div>
      </div>
      {selected && <ConceptDetail id={selected} titles={titles} onClose={close} />}
    </main>
  );
}
