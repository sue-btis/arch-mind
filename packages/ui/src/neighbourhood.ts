import type { Concept } from "@arch-mind/rules/model";

export interface Edge {
  source: string;
  target: string;
  type: string;
  citation: string;
  explanation: string;
}

export interface Neighbourhood {
  id: string;
  outgoing: Edge[];
  incoming: Edge[];
  // The concepts the relations connect to the selected one, never the selected one itself.
  connected: string[];
}

// A relation to the concept itself connects nothing, and a relation to a concept that is not shown has no other end to select.
export function neighbourhood(concepts: Concept[], id: string): Neighbourhood | null {
  const selected = concepts.find((c) => c.id === id);
  if (!selected) return null;
  const shown = new Set(concepts.map((c) => c.id));
  const edge = (source: string, r: Concept["relations"][number]): Edge => ({ source, target: r.to, type: r.type, citation: r.source, explanation: r.explanation });
  const outgoing = selected.relations.filter((r) => r.to !== id && shown.has(r.to)).map((r) => edge(id, r));
  const incoming = concepts.flatMap((c) => (c.id === id ? [] : c.relations.filter((r) => r.to === id).map((r) => edge(c.id, r))));
  const connected = [...new Set([...outgoing.map((e) => e.target), ...incoming.map((e) => e.source)])];
  return { id, outgoing, incoming, connected };
}
