import { SEE_I_PARTS, type Concept, type QuestionState } from "@arch-mind/rules/model";
import { useEffect, useRef, useState } from "react";

interface Detail {
  concept: Concept;
  questions: QuestionState[];
}

export const SEE_I_LABELS = { statement: "State", elaboration: "Elaborate", example: "Exemplify", illustration: "Illustrate" } as const;
export const SECTION_TITLE = "mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-ink-muted";

export function ConceptDetail({ id, titles, onClose }: { id: string; titles: Map<string, string>; onClose: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialog.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

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
  return (
    <div
      ref={dialog}
      role="dialog"
      aria-modal="false"
      aria-labelledby="concept-detail-title"
      tabIndex={-1}
      data-testid="concept-detail"
      className="fixed bottom-4 right-4 top-4 z-30 w-[420px] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-line bg-panel p-4 text-[13px] shadow-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id="concept-detail-title" className="text-[17px] font-semibold tracking-tight">
          {concept?.title ?? id}
        </h2>
        <button type="button" onClick={onClose} className="rounded-lg border border-line px-2.5 py-1 text-ink-muted hover:text-ink">
          Close
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3">
          Could not load this concept: {error}
        </p>
      )}
      {!detail && !error && <p className="mt-3 text-ink-muted">Loading</p>}
      {detail && concept && (
        <div className="mt-3 flex flex-col gap-5">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-ink-muted">Layer</dt>
            <dd>{concept.layer}</dd>
            <dt className="text-ink-muted">Domains</dt>
            <dd>{concept.domains.join(", ") || "none"}</dd>
            <dt className="text-ink-muted">Concerns</dt>
            <dd>{concept.concerns.join(", ") || "none"}</dd>
          </dl>

          <section aria-labelledby="detail-see-i">
            <h3 id="detail-see-i" className={SECTION_TITLE}>
              SEE-I
            </h3>
            {SEE_I_PARTS.map((part) => (
              <div key={part} className="mb-2">
                <p className="font-medium">{SEE_I_LABELS[part]}</p>
                <p className="whitespace-pre-wrap">{concept.seeI[part]}</p>
              </div>
            ))}
          </section>

          <section aria-labelledby="detail-relations">
            <h3 id="detail-relations" className={SECTION_TITLE}>
              Relations ({concept.relations.length})
            </h3>
            {concept.relations.length === 0 && <p className="text-ink-muted">None yet.</p>}
            <ul className="flex flex-col gap-3">
              {concept.relations.map((r) => (
                <li key={`${r.type}>${r.to}`}>
                  <p className="font-medium">
                    {r.type} to {titles.get(r.to) ?? r.to}
                  </p>
                  <p className="text-ink-muted">Source: {r.source}</p>
                  <p>{r.explanation}</p>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="detail-episodes">
            <h3 id="detail-episodes" className={SECTION_TITLE}>
              Episodes ({concept.episodes.length})
            </h3>
            {concept.episodes.length === 0 && <p className="text-ink-muted">None yet.</p>}
            <ul className="flex flex-col gap-3">
              {concept.episodes.map((e, i) => (
                <li key={i}>
                  <p className="font-medium">
                    {e.project}
                    {e.date ? ` · ${e.date}` : ""}
                  </p>
                  <p>{e.situation}</p>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="detail-questions">
            <h3 id="detail-questions" className={SECTION_TITLE}>
              Recall questions
            </h3>
            <ul className="flex flex-col gap-3">
              {detail.questions.map((q) => (
                <li key={q.question}>
                  <p>{q.text}</p>
                  <p className="text-ink-muted">
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
