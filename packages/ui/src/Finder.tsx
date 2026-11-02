import type { Concept } from "@arch-mind/rules/model";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { findConcepts } from "./finder.ts";
import { pictogramFor } from "./layout.ts";
import { Pictogram } from "./pictogram-art.tsx";

export function Finder({ concepts, onChoose, onClose }: { concepts: Concept[]; onChoose: (id: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [current, setCurrent] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const listId = useId();
  const matches = useMemo(() => findConcepts(concepts, query), [concepts, query]);
  const optionId = (i: number) => `${listId}-${i}`;

  useEffect(() => {
    input.current?.focus();
  }, []);
  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [current, matches]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      // The drawer and a pinned popover close on a document-level Escape; this one belongs to the finder alone.
      e.stopPropagation();
      return onClose();
    }
    if (e.key === "Tab") return e.preventDefault();
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setCurrent((i) => Math.max(0, Math.min(matches.length - 1, i + (e.key === "ArrowDown" ? 1 : -1))));
    }
    if (e.key === "Enter" && matches[current]) {
      e.preventDefault();
      onChoose(matches[current].concept.id);
    }
  };

  return (
    <>
      <div className="scrim-in fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Find a concept"
        className="finder-in island fixed left-1/2 top-[18%] z-50 w-[560px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[18px]"
        onKeyDown={onKeyDown}
      >
        <input
          ref={input}
          role="combobox"
          aria-expanded={matches.length > 0}
          aria-controls={listId}
          aria-activedescendant={matches.length > 0 ? optionId(current) : undefined}
          aria-autocomplete="list"
          aria-label="Concept title or designator"
          autoComplete="off"
          spellCheck={false}
          placeholder="Find a concept…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setCurrent(0);
          }}
          className="w-full border-0 border-b-[0.5px] border-[var(--hair)] bg-transparent px-[18px] py-4 text-[17px] font-medium text-ink outline-none placeholder:text-ink-muted"
        />
        <div ref={list} id={listId} role="listbox" aria-label="Matches" className="max-h-[360px] overflow-auto p-1.5">
          {matches.map(({ concept, designator }, i) => (
            <div
              key={concept.id}
              id={optionId(i)}
              role="option"
              aria-selected={i === current}
              data-id={concept.id}
              className="finder-res press flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[13px]"
              onMouseMove={() => i !== current && setCurrent(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onChoose(concept.id)}
            >
              <Pictogram id={pictogramFor(concept)} layer={concept.layer} size={28} />
              <span className="min-w-0">
                <span className="des font-semibold tabular-nums" style={{ "--k": `var(--layer-${concept.layer})` } as React.CSSProperties}>
                  {designator}
                </span>{" "}
                <span className="ttl">{concept.title}</span>
                <br />
                <span className="muted text-[12px]">{concept.layer}</span>
              </span>
            </div>
          ))}
        </div>
        <p role="status" className={`text-[13px] text-ink-muted ${matches.length === 0 ? "px-4 py-3" : "sr-only"}`}>
          {matches.length === 0 ? "No concept matches." : ""}
        </p>
      </div>
    </>
  );
}
