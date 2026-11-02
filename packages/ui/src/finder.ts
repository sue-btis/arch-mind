import type { Concept } from "@arch-mind/rules/model";
import { anyOf, type Filters } from "./filter.ts";
import { designators } from "./layout.ts";

export interface FinderMatch {
  concept: Concept;
  designator: string;
}

// Titles and designators only: SEE-I, episode and relation text are never searched. Designators are numbered over the whole store,
// not the filtered board, so a concept the filters hide still has one name.
export function findConcepts(concepts: Concept[], query: string): FinderMatch[] {
  const names = designators(concepts);
  const q = query.trim().toLowerCase();
  const all = concepts.map((concept) => ({ concept, designator: names.get(concept.id)! }));
  if (!q) return all;
  const rank = ({ concept, designator }: FinderMatch) => {
    const title = concept.title.toLowerCase();
    if (designator.toLowerCase().includes(q)) return 0;
    if (title.startsWith(q)) return 1;
    return title.includes(q) ? 2 : -1;
  };
  return all
    .map((match) => ({ match, rank: rank(match) }))
    .filter((r) => r.rank >= 0)
    .sort((a, b) => a.rank - b.rank)
    .map((r) => r.match);
}

// Only the facets that exclude the concept are reset, so the rest of the author's filters survive a finder choice.
export function clearHidingFacets(c: Concept, f: Filters): Filters {
  return {
    layers: anyOf(f.layers, [c.layer]) ? f.layers : [],
    domains: anyOf(f.domains, c.domains) ? f.domains : [],
    concerns: anyOf(f.concerns, c.concerns) ? f.concerns : [],
  };
}
