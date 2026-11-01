import type { FileProblem, Layer } from "@arch-mind/rules/model";
import type { CSSProperties, ReactNode } from "react";
import { NO_FILTERS, hasFilters, type Filters } from "./filter.ts";
import { WIRE_LEGEND, wireAbbrev, wireStyle } from "./wire-code.ts";

export interface FacetCatalog {
  layers: Filters["layers"];
  domains: string[];
  concerns: string[];
}

export const FILTERS_WIDTH = 200;

const toggled = <T extends string>(list: T[], value: T): T[] => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
const LABEL = "text-[11px] font-semibold uppercase tracking-widest text-ink-muted";

function LayerPictogram({ layer }: { layer: Layer }) {
  return (
    <svg viewBox="0 0 48 48" width="22" height="22" aria-hidden="true" className="plates pic shrink-0 overflow-visible" style={{ "--k": `var(--layer-${layer})` } as CSSProperties}>
      <use href={`#${layer}`} width="48" height="48" />
    </svg>
  );
}

function FilterGroup<T extends string>({
  legend,
  values,
  selected,
  onToggle,
  counts,
}: {
  legend: string;
  values: T[];
  selected: T[];
  onToggle: (v: T) => void;
  counts?: Record<string, number>;
}) {
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className={`mb-1.5 p-0 ${LABEL}`}>{legend}</legend>
      {values.length === 0 && <p className="text-[13px] text-ink-muted">None configured.</p>}
      {values.map((v) => (
        <label
          key={v}
          className={`flex cursor-pointer items-center gap-2 text-[13px] ${counts ? "my-1 rounded-lg border border-line px-2 py-1 has-[:checked]:border-ink" : "py-0.5"}`}
        >
          <input type="checkbox" checked={selected.includes(v)} onChange={() => onToggle(v)} />
          {counts && <LayerPictogram layer={v as Layer} />}
          <span className="break-words">{v}</span>
          {counts && (
            <span aria-hidden="true" className="ml-auto tabular-nums text-ink-muted">
              {counts[v] ?? 0}
            </span>
          )}
        </label>
      ))}
    </fieldset>
  );
}

export function Sidebar({
  facets,
  filters,
  onChange,
  layerCounts,
  open,
  onToggle,
  children,
}: {
  facets: FacetCatalog;
  filters: Filters;
  onChange: (f: Filters) => void;
  layerCounts: Record<Layer, number>;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <aside
      aria-label="Filters"
      className="absolute left-4 top-[72px] z-10 flex max-h-[calc(100%-144px)] flex-col gap-3 rounded-2xl border border-line bg-panel p-3 shadow-lg"
      style={{ width: open ? FILTERS_WIDTH : undefined }}
    >
      <button type="button" aria-expanded={open} aria-controls="filters-body" onClick={onToggle} className={`flex items-center justify-between gap-3 text-left ${LABEL} hover:text-ink`}>
        Filters
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      <div id="filters-body" hidden={!open} className="flex min-h-0 flex-col gap-5 overflow-y-auto">
        <FilterGroup legend="Layers" values={facets.layers} selected={filters.layers} counts={layerCounts} onToggle={(v) => onChange({ ...filters, layers: toggled(filters.layers, v) })} />
        <FilterGroup legend="Domains" values={facets.domains} selected={filters.domains} onToggle={(v) => onChange({ ...filters, domains: toggled(filters.domains, v) })} />
        <FilterGroup legend="Concerns" values={facets.concerns} selected={filters.concerns} onToggle={(v) => onChange({ ...filters, concerns: toggled(filters.concerns, v) })} />
        {hasFilters(filters) && (
          <button type="button" className="self-start rounded-lg border border-line px-2.5 py-1 text-[13px] text-ink-muted hover:text-ink" onClick={() => onChange(NO_FILTERS)}>
            Clear filters
          </button>
        )}
        {children}
      </div>
    </aside>
  );
}

export function WireLegend() {
  return (
    <section aria-labelledby="wires-title" className="absolute bottom-4 left-4 z-10 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border border-line bg-panel px-3 py-2 text-[13px] shadow-lg">
      <h2 id="wires-title" className={LABEL}>
        Wires
      </h2>
      {WIRE_LEGEND.map(({ code, type }) => {
        const { stroke, strokeDasharray } = wireStyle(code);
        return (
          <span key={code} className="flex items-center gap-2">
            <svg width="20" height="8" aria-hidden="true" className="shrink-0">
              <line x1="0" y1="4" x2="20" y2="4" stroke={stroke} strokeWidth="2" strokeDasharray={strokeDasharray} />
            </svg>
            <span className="text-[11px] font-semibold text-ink-muted">{wireAbbrev(code)}</span>
            {type}
          </span>
        );
      })}
      <span className="flex items-center gap-2 text-ink-muted">
        <svg width="20" height="8" aria-hidden="true" className="shrink-0">
          <line x1="0" y1="4" x2="20" y2="4" stroke="var(--wire)" strokeWidth="2" />
        </svg>
        any other type
      </span>
    </section>
  );
}

export function ProblemsDisclosure({ problems }: { problems: FileProblem[] }) {
  return (
    <details data-testid="problems" className="relative">
      <summary className="cursor-pointer text-[13px] text-ink">
        {problems.length} {problems.length === 1 ? "file has" : "files have"} problems
      </summary>
      <div className="absolute right-0 top-full z-20 mt-4 w-80 rounded-2xl border border-line bg-panel p-4 shadow-lg">
        <h2 className={`mb-1.5 ${LABEL}`}>Files with problems ({problems.length})</h2>
        <ul className="flex flex-col gap-2 text-[13px]">
          {problems.map((p) => (
            <li key={p.file}>
              <p className="break-all font-medium">{p.file}</p>
              <p className="break-words text-ink-muted">{p.reason}</p>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
