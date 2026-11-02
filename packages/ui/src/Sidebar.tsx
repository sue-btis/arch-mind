import type { FileProblem, Layer } from "@arch-mind/rules/model";
import type { ReactNode } from "react";
import { Pictogram } from "./pictogram-art.tsx";
import { NO_FILTERS, hasFilters, type Filters } from "./filter.ts";
import type { WireKind } from "./prominence.ts";
import { WIRE_LEGEND, wireAbbrev, wireStyle } from "./wire-code.ts";

export interface FacetCatalog {
  layers: Filters["layers"];
  domains: string[];
  concerns: string[];
}

export const FILTERS_WIDTH = 200;

const toggled = <T extends string>(list: T[], value: T): T[] => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
const LABEL = "text-[11px] font-semibold uppercase tracking-widest text-ink-muted";

const CHIP = "flex min-h-7 cursor-pointer items-center gap-1.5 rounded-full border border-line px-2.5 py-0.5 text-[13px] press aria-checked:border-accent aria-checked:bg-accent aria-checked:text-on-accent aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-on-accent";

function FilterGroup<T extends string>({
  legend,
  values,
  selected,
  onToggle,
  onAll,
  counts,
}: {
  legend: string;
  values: T[];
  selected: T[];
  onToggle: (v: T) => void;
  onAll: () => void;
  counts?: Record<string, number>;
}) {
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className={`mb-1.5 p-0 ${LABEL}`}>{legend}</legend>
      {values.length === 0 ? (
        <p className="text-[13px] text-ink-muted">None configured.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={CHIP} aria-pressed={selected.length === 0} onClick={onAll}>
            All
          </button>
          {values.map((v) => (
            <button key={v} type="button" role="checkbox" aria-checked={selected.includes(v)} className={CHIP} onClick={() => onToggle(v)}>
              {counts && <Pictogram id={v} layer={v} size={20} />}
              <span className="break-words">{v}</span>
              {counts && (
                <span aria-hidden="true" className="tabular-nums opacity-80">
                  {counts[v] ?? 0}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
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
  away,
  children,
}: {
  facets: FacetCatalog;
  filters: Filters;
  onChange: (f: Filters) => void;
  layerCounts: Record<Layer, number>;
  open: boolean;
  onToggle: () => void;
  away: boolean;
  children: ReactNode;
}) {
  return (
    <aside
      aria-label="Filters"
      data-away={away || undefined}
      inert={away}
      className="island absolute left-4 top-[72px] z-10 flex max-h-[calc(100%-144px)] flex-col gap-3 rounded-2xl p-3"
      style={{ width: open ? FILTERS_WIDTH : undefined }}
    >
      <button type="button" aria-expanded={open} aria-controls="filters-body" onClick={onToggle} className={`press flex items-center justify-between gap-3 text-left ${LABEL} hover:text-ink`}>
        Filters
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      <div id="filters-body" hidden={!open} className="flex min-h-0 flex-col gap-5 overflow-y-auto">
        <FilterGroup legend="Layers" values={facets.layers} selected={filters.layers} counts={layerCounts} onToggle={(v) => onChange({ ...filters, layers: toggled(filters.layers, v) })} onAll={() => onChange({ ...filters, layers: [] })} />
        <FilterGroup legend="Domains" values={facets.domains} selected={filters.domains} onToggle={(v) => onChange({ ...filters, domains: toggled(filters.domains, v) })} onAll={() => onChange({ ...filters, domains: [] })} />
        <FilterGroup legend="Concerns" values={facets.concerns} selected={filters.concerns} onToggle={(v) => onChange({ ...filters, concerns: toggled(filters.concerns, v) })} onAll={() => onChange({ ...filters, concerns: [] })} />
        {hasFilters(filters) && (
          <button type="button" className="press self-start rounded-lg border border-line px-2.5 py-1 text-[13px] text-ink-muted hover:text-ink" onClick={() => onChange(NO_FILTERS)}>
            Clear filters
          </button>
        )}
        {children}
      </div>
    </aside>
  );
}

const LEGEND_TYPES: { kind: WireKind; type: string }[] = [...WIRE_LEGEND.map(({ code, type }) => ({ kind: code, type })), { kind: "other", type: "any other type" }];

export function WireLegend({ away, active, onChange }: { away: boolean; active: WireKind | null; onChange: (kind: WireKind | null) => void }) {
  return (
    <section aria-labelledby="wires-title" data-away={away || undefined} data-isolating={active ? "" : undefined} inert={away} className="island legend absolute bottom-4 left-4 z-10 flex flex-wrap items-center gap-x-1 gap-y-1 rounded-2xl px-2 py-1.5 text-[13px]">
      <h2 id="wires-title" className={`px-1.5 ${LABEL}`}>
        Wires
      </h2>
      {LEGEND_TYPES.map(({ kind, type }) => {
        const { stroke, strokeDasharray } = wireStyle(kind === "other" ? null : kind);
        return (
          <button key={kind} type="button" aria-pressed={active === kind} aria-label={type} className="press legend-btn flex items-center gap-2 rounded-[10px] px-2 py-1" onClick={() => onChange(active === kind ? null : kind)}>
            <svg width="20" height="8" aria-hidden="true" className="shrink-0">
              <line x1="0" y1="4" x2="20" y2="4" stroke={stroke} strokeWidth="2" strokeDasharray={strokeDasharray} />
            </svg>
            {kind !== "other" && (
              <span aria-hidden="true" className="legend-sub text-[11px] font-semibold text-ink-muted">
                {wireAbbrev(kind)}
              </span>
            )}
            <span aria-hidden="true" className={kind === "other" ? "legend-sub text-ink-muted" : undefined}>
              {type}
            </span>
          </button>
        );
      })}
    </section>
  );
}

export function ProblemsDisclosure({ problems }: { problems: FileProblem[] }) {
  return (
    <details data-testid="problems" className="relative">
      <summary className="press cursor-pointer text-[13px] text-ink">
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
