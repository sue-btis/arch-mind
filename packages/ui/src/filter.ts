import type { Concept, Layer } from "@arch-mind/rules/model";

export interface Filters {
  layers: Layer[];
  domains: string[];
  concerns: string[];
}

export const NO_FILTERS: Filters = { layers: [], domains: [], concerns: [] };

export function hasFilters(f: Filters): boolean {
  return f.layers.length + f.domains.length + f.concerns.length > 0;
}

export const anyOf = (selected: string[], values: string[]) => selected.length === 0 || values.some((v) => selected.includes(v));

export function matchesFilters(c: Concept, f: Filters): boolean {
  return anyOf(f.layers, [c.layer]) && anyOf(f.domains, c.domains) && anyOf(f.concerns, c.concerns);
}

export function filterConcepts(concepts: Concept[], f: Filters): Concept[] {
  const kept = concepts.filter((c) => matchesFilters(c, f));
  const ids = new Set(kept.map((c) => c.id));
  return kept.map((c) => ({ ...c, relations: c.relations.filter((r) => ids.has(r.to)) }));
}
