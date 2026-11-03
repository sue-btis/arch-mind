import { SEE_I_PARTS, type Concept, type QuestionState } from "@arch-mind/rules/model";
import { useEffect, useMemo, useRef, useState } from "react";
import { pictogramFor } from "./layout.ts";
import { neighbourhood, type Edge } from "./neighbourhood.ts";
import { Pictogram } from "./pictogram-art.tsx";

interface Detail {
  concept: Concept;
  questions: QuestionState[];
}

export const SEE_I_LABELS = { statement: "State", elaboration: "Elaborate", example: "Exemplify", illustration: "Illustrate" } as const;
export const SHEET_WIDTH = 420;
export const SECTION_TITLE = "mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-ink-muted";
const GROUP = "rounded-2xl border border-line bg-panel/60 p-3";

export function ConceptDetail({
  id,
  concepts,
  names,
  focused,
  keepOnEscape,
  onSelect,
  canFocus,
  onToggleFocus,
  onClose,
}: {
  id: string;
  concepts: Concept[];
  names: Map<string, string>;
  focused: boolean;
  // Focus and an open group each take their own Escape before the drawer closes.
  keepOnEscape: boolean;
  onSelect: (id: string) => void;
  canFocus: boolean;
  onToggleFocus: () => void;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const byId = useMemo(() => new Map(concepts.map((c) => [c.id, c])), [concepts]);
  const hood = useMemo(() => neighbourhood(concepts, id), [concepts, id]);

  useEffect(() => {
    dialog.current?.focus();
    dialog.current?.scrollTo({ top: 0 });
  }, [id]);

  useEffect(() => {
    // While focus is on or a group is open, the first Escape belongs to the app and the drawer is kept.
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !e.defaultPrevented && !keepOnEscape && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, keepOnEscape]);

  useEffect(() => {
    const abort = new AbortController();
    setDetail(null);
    setError(null);
    fetch(`/api/concepts/${encodeURIComponent(id)}`, { signal: abort.signal })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as Partial<Detail> & { error?: string };
        if (!res.ok || !body.concept) throw new Error(body.error ?? `HTTP ${res.status}`);
        setDetail({ concept: body.concept, questions: body.questions ?? [] });
      })
      .catch((e: Error) => e.name !== "AbortError" && setError(e.message));
    return () => abort.abort();
  }, [id]);

  const concept = detail?.concept;
  const name = (conceptId: string) => `${names.get(conceptId) ?? ""} ${byId.get(conceptId)?.title ?? conceptId}`.trim();

  const relationRows = (edges: Edge[], label: string) => (
    <div>
      <h4 className="mb-1 text-[12px] font-semibold text-ink-muted">
        {label} ({edges.length})
      </h4>
      {edges.length === 0 && <p className="text-ink-muted">None.</p>}
      <ul className="flex flex-col gap-2">
        {edges.map((e) => {
          const otherId = e.source === id ? e.target : e.source;
          const other = byId.get(otherId);
          return (
            <li key={`${e.source}>${e.type}>${e.target}`} data-testid="relation-row" data-other={otherId}>
              <button type="button" className="press flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left hover:bg-canvas" onClick={() => onSelect(otherId)}>
                {other && <Pictogram id={pictogramFor(other)} layer={other.layer} size={28} />}
                <span className="min-w-0">
                  <span className={e.source === id ? "text-ink-muted" : "font-semibold"}>{name(e.source)}</span>
                  {" → "}
                  <span className="font-medium">{e.type}</span>
                  {" → "}
                  <span className={e.target === id ? "text-ink-muted" : "font-semibold"}>{name(e.target)}</span>
                </span>
              </button>
              <p className="px-2 text-ink-muted">Source: {e.citation}</p>
              <p className="px-2">{e.explanation}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );

  const tinted = concept ? ({ "--k": `var(--layer-${concept.layer})` } as React.CSSProperties) : undefined;
  return (
    <div
      ref={dialog}
      role="dialog"
      aria-modal="false"
      aria-labelledby="concept-detail-title"
      tabIndex={-1}
      data-testid="concept-detail"
      data-layer={concept?.layer}
      style={{ width: SHEET_WIDTH, ...tinted }}
      className="sheet-in drawer fixed bottom-4 right-4 top-4 z-30 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-3xl text-[13px]"
    >
      <div className="drawer-head flex items-start gap-3.5 p-4">
        {concept && <Pictogram id={pictogramFor(concept)} layer={concept.layer} size={64} />}
        <div className="min-w-0 flex-1">
          {concept && (
            <span className="layer-pill" data-testid="layer-pill">
              {names.get(id)} · {concept.layer}
            </span>
          )}
          <h2 id="concept-detail-title" className="mt-1 text-[19px] font-semibold leading-tight tracking-tight">
            {concept?.title ?? byId.get(id)?.title ?? id}
          </h2>
          {concept && (
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Facets">
              {[...concept.domains.map((d) => ({ kind: "Domain", value: d })), ...concept.concerns.map((c) => ({ kind: "Concern", value: c }))].map((f) => (
                <li key={`${f.kind}:${f.value}`} className="rounded-full border border-line px-2 py-0.5 text-[12px] text-ink-muted">
                  <span className="sr-only">{f.kind}: </span>
                  {f.value}
                </li>
              ))}
            </ul>
          )}
        </div>
        {canFocus && (
          <button type="button" onClick={onToggleFocus} aria-pressed={focused} className="press focus-btn">
            Focus
          </button>
        )}
        <button type="button" onClick={onClose} aria-label="Close" className="press close-btn">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="m3 3 6 6M9 3 3 9" />
          </svg>
        </button>
      </div>
      {error && (
        <p role="alert" className="mx-4 text-correction">
          Could not load this concept: {error}
        </p>
      )}
      {!detail && !error && <p className="mx-4 text-ink-muted">Loading</p>}
      {detail && concept && (
        <div className="flex flex-col gap-3 px-3 pb-4">
          <section aria-labelledby="detail-see-i" className={GROUP}>
            <h3 id="detail-see-i" className={SECTION_TITLE}>
              SEE-I
            </h3>
            {SEE_I_PARTS.map((part) => (
              <div key={part} className="mb-2 last:mb-0">
                <p className="font-medium">{SEE_I_LABELS[part]}</p>
                {part === "illustration" && concept.hasIllustration ? (
                  <div className="illustration-part">
                    <p className="whitespace-pre-wrap">{concept.seeI[part]}</p>
                    <img
                      className="illustration-img"
                      data-testid="concept-illustration"
                      src={`/api/concepts/${encodeURIComponent(concept.id)}/illustration`}
                      alt={concept.seeI.illustration.replace(/\s+/g, " ").trim() || `Illustration of ${concept.title}`}
                    />
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{concept.seeI[part]}</p>
                )}
              </div>
            ))}
          </section>

          <section aria-labelledby="detail-relations" className={GROUP}>
            <h3 id="detail-relations" className={SECTION_TITLE}>
              Relations ({(hood?.outgoing.length ?? 0) + (hood?.incoming.length ?? 0)})
            </h3>
            <div className="flex flex-col gap-3">
              {relationRows(hood?.outgoing ?? [], "Outgoing")}
              {relationRows(hood?.incoming ?? [], "Incoming")}
            </div>
          </section>

          <section aria-labelledby="detail-episodes" className={GROUP}>
            <h3 id="detail-episodes" className={SECTION_TITLE}>
              Episodes ({concept.episodes.length})
            </h3>
            {concept.episodes.length === 0 && <p className="text-ink-muted">None yet.</p>}
            <ul className="flex flex-col gap-3">
              {concept.episodes.map((e, i) => (
                <li key={i}>
                  <p className="font-medium">
                    {e.project}
                    {e.date && <span className="tabular-nums"> · {e.date}</span>}
                  </p>
                  <p>{e.situation}</p>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="detail-questions" className={GROUP}>
            <h3 id="detail-questions" className={SECTION_TITLE}>
              Recall questions
            </h3>
            <ul className="flex flex-col gap-3">
              {detail.questions.map((q) => (
                <li key={q.question}>
                  <p>{q.text}</p>
                  <p className="tabular-nums text-ink-muted">
                    Box {q.box} · due {q.due}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
