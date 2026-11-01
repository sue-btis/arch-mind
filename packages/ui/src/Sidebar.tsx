import type { FileProblem } from "@arch-mind/rules/model";
import { NO_FILTERS, hasFilters, type Filters } from "./filter.ts";

export interface FacetCatalog {
  layers: Filters["layers"];
  domains: string[];
  concerns: string[];
}

const toggled = <T extends string>(list: T[], value: T): T[] => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

function FilterGroup<T extends string>({ legend, values, selected, onToggle }: { legend: string; values: T[]; selected: T[]; onToggle: (v: T) => void }) {
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="mb-1.5 p-0 text-[11px] font-semibold uppercase tracking-widest text-ink-muted">{legend}</legend>
      {values.length === 0 && <p className="text-[13px] text-ink-muted">None configured.</p>}
      {values.map((v) => (
        <label key={v} className="flex cursor-pointer items-center gap-2 py-0.5 text-[13px]">
          <input type="checkbox" checked={selected.includes(v)} onChange={() => onToggle(v)} />
          <span className="break-words">{v}</span>
        </label>
      ))}
    </fieldset>
  );
}

export function Sidebar({
  facets,
  filters,
  onChange,
  problems,
}: {
  facets: FacetCatalog;
  filters: Filters;
  onChange: (f: Filters) => void;
  problems: FileProblem[];
}) {
  return (
    <aside className="flex w-[200px] shrink-0 flex-col gap-5 rounded-2xl border border-line bg-panel p-4" aria-label="Filters and problems">
      <FilterGroup legend="Layers" values={facets.layers} selected={filters.layers} onToggle={(v) => onChange({ ...filters, layers: toggled(filters.layers, v) })} />
      <FilterGroup legend="Domains" values={facets.domains} selected={filters.domains} onToggle={(v) => onChange({ ...filters, domains: toggled(filters.domains, v) })} />
      <FilterGroup legend="Concerns" values={facets.concerns} selected={filters.concerns} onToggle={(v) => onChange({ ...filters, concerns: toggled(filters.concerns, v) })} />
      {hasFilters(filters) && (
        <button type="button" className="self-start rounded-lg border border-line px-2.5 py-1 text-[13px] text-ink-muted hover:text-ink" onClick={() => onChange(NO_FILTERS)}>
          Clear filters
        </button>
      )}
      {problems.length > 0 && (
        <section aria-labelledby="problems-title" data-testid="problems">
          <h2 id="problems-title" className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
            Files that could not be read ({problems.length})
          </h2>
          <ul className="flex flex-col gap-2 text-[13px]">
            {problems.map((p) => (
              <li key={p.file}>
                <p className="break-all font-medium">{p.file}</p>
                <p className="break-words text-ink-muted">{p.reason}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}
