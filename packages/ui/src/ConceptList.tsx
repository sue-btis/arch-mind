import { LAYERS, PICTOGRAMS, type Concept } from "@arch-mind/rules/model";
import { designators, pictogramFor } from "./layout.ts";
import type { OpenConcept } from "./LayerView.tsx";

const MEANING = new Map(PICTOGRAMS.map((p) => [p.id, p.meaning]));

// The plates are a picture; this list carries the same concepts, pictograms and relations as text for keyboard and screen reader use.
export function ConceptList({ concepts, onOpen }: { concepts: Concept[]; onOpen: OpenConcept }) {
  const designator = designators(concepts);
  const names = new Map(concepts.map((c) => [c.id, `${designator.get(c.id)} ${c.title}`]));
  const relations = new Map(concepts.map((c) => [c.id, c.relations.filter((r) => names.has(r.to) && r.to !== c.id)]));
  const ordered = LAYERS.flatMap((layer) => concepts.filter((c) => c.layer === layer));
  return (
    <details data-testid="concept-list" className="border-t border-line pt-2 text-[13px]">
      <summary className="cursor-pointer py-1 font-medium">
        Concepts and relations ({concepts.length} concepts, {[...relations.values()].reduce((n, r) => n + r.length, 0)} relations)
      </summary>
      <ul className="mt-2 flex flex-col gap-3">
        {ordered.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              className="rounded text-left font-medium underline decoration-line underline-offset-4 hover:decoration-ink"
              onClick={(e) => onOpen(c.id, e.currentTarget)}
            >
              {names.get(c.id)}
            </button>
            <span className="text-ink-muted">
              {" "}
              · {c.layer} layer · pictogram: {MEANING.get(pictogramFor(c)) ?? pictogramFor(c)}
            </span>
            <ul className="ml-4 mt-1 list-disc text-ink-muted">
              {relations.get(c.id)!.map((r) => (
                <li key={`${r.type}>${r.to}`}>
                  <span className="text-ink">{r.type}</span> → {names.get(r.to)}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </details>
  );
}
