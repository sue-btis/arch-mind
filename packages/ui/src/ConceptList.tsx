import { LAYERS, PICTOGRAMS } from "@arch-mind/rules/model";
import type { OpenConcept } from "./LayerView.tsx";
import type { PlateLayout } from "./layout.ts";

const MEANING = new Map(PICTOGRAMS.map((p) => [p.id, p.meaning]));

// The plates are a picture; this list carries the same concepts, pictograms and relations as text for keyboard and screen reader use.
export function ConceptList({ layout, onOpen }: { layout: PlateLayout; onOpen: OpenConcept }) {
  const names = new Map(layout.nodes.map((n) => [n.id, `${n.designator} ${n.title}`]));
  const ordered = LAYERS.flatMap((layer) => layout.nodes.filter((n) => n.layer === layer));
  return (
    <details data-testid="concept-list" className="border-t border-line px-4 py-2 text-[13px]">
      <summary className="cursor-pointer py-1 font-medium">
        Concepts and relations ({layout.nodes.length} concepts, {layout.edges.length} relations)
      </summary>
      <ul className="mt-2 flex flex-col gap-3">
        {ordered.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              className="rounded text-left font-medium underline decoration-line underline-offset-4 hover:decoration-ink"
              onClick={(e) => onOpen(n.id, e.currentTarget)}
            >
              {names.get(n.id)}
            </button>
            <span className="text-ink-muted">
              {" "}
              · {n.layer} layer · pictogram: {MEANING.get(n.pictogram) ?? n.pictogram}
            </span>
            <ul className="ml-4 mt-1 list-disc text-ink-muted">
              {layout.edges
                .filter((e) => e.source === n.id)
                .map((e) => (
                  <li key={e.id}>
                    <span className="text-ink">{e.label}</span> → {names.get(e.target)}
                  </li>
                ))}
            </ul>
          </li>
        ))}
      </ul>
    </details>
  );
}
