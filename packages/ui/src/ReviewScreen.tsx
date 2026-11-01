import { SEE_I_PARTS, type Concept, type QuestionState } from "@arch-mind/rules/model";
import { useEffect, useRef, useState } from "react";
import { SEE_I_LABELS, SECTION_TITLE } from "./ConceptDetail.tsx";
import { boxLabel, dueHeading } from "./review.ts";

type Result = "right" | "wrong";

const BUTTON = "rounded-lg px-3 py-1.5 disabled:opacity-60";
const PRIMARY = `${BUTTON} bg-accent text-on-accent`;
const SECONDARY = `${BUTTON} border border-line text-ink hover:bg-canvas`;

async function readJson<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body;
}

export function ReviewScreen({ titles, onOpenConcept }: { titles: Map<string, string>; onOpenConcept: (id: string, from: HTMLElement) => void }) {
  const [queue, setQueue] = useState<QuestionState[] | null>(null);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<Concept | null>(null);
  const [marked, setMarked] = useState<{ result: Result; state: QuestionState } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/reviews/due", { signal: abort.signal })
      .then((res) => readJson<QuestionState[]>(res))
      .then(setQueue, (e: Error) => e.name !== "AbortError" && setError(e.message));
    return () => abort.abort();
  }, []);

  useEffect(() => {
    heading.current?.focus();
  }, [index, queue]);

  const current = queue?.[index];

  async function attempt(work: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const reveal = (question: QuestionState) =>
    attempt(async () => {
      const detail = await readJson<{ concept: Concept }>(await fetch(`/api/concepts/${encodeURIComponent(question.conceptId)}`));
      setAnswer(detail.concept);
    });

  const mark = (question: QuestionState, result: Result) =>
    attempt(async () => {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.question, result }),
      });
      setMarked({ result, state: await readJson<QuestionState>(res) });
    });

  function next() {
    setAnswer(null);
    setMarked(null);
    setError(null);
    setIndex((i) => i + 1);
  }

  return (
    <section aria-labelledby="review-title" data-testid="review" className="mx-auto flex w-full max-w-2xl flex-col gap-4 rounded-2xl border border-line bg-panel p-6 text-[13px]">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="review-title" className="text-[17px] font-semibold tracking-tight">
          Review
        </h2>
        <p className="tabular-nums text-ink-muted">
          <span data-testid="due-count" aria-live="polite">
            {queue ? dueHeading(queue.length) : ""}
          </span>
          {queue && current && (
            <span data-testid="question-position">
              {" · "}Question {index + 1} of {queue.length}
            </span>
          )}
        </p>
      </div>
      {error && (
        <p role="alert" className="text-correction">
          {queue ? "Something went wrong" : "Could not load the due questions"}: {error}
        </p>
      )}
      {!queue && !error && <p className="text-ink-muted">Loading</p>}
      {queue && !current && queue.length > 0 && <p data-testid="review-done">All caught up: {queue.length} reviewed.</p>}

      {queue && current && (
        <div className="flex flex-col gap-4" data-testid="review-question">
          <h3 ref={heading} tabIndex={-1} className="text-[15px] font-medium">
            {current.text}
          </h3>

          {!answer && !marked && (
            <div>
              <button type="button" className={PRIMARY} disabled={busy} onClick={() => reveal(current)}>
                Show answer
              </button>
            </div>
          )}

          {answer && (
            <div className="reveal-in flex flex-col gap-4" data-testid="review-answer">
              <p className="font-semibold">{answer.title}</p>
              <section aria-labelledby="review-see-i">
                <h3 id="review-see-i" className={SECTION_TITLE}>
                  SEE-I
                </h3>
                {SEE_I_PARTS.map((part) => (
                  <div key={part} className="mb-2">
                    <p className="font-medium">{SEE_I_LABELS[part]}</p>
                    <p className="whitespace-pre-wrap">{answer.seeI[part]}</p>
                  </div>
                ))}
              </section>
              <section aria-labelledby="review-relations">
                <h3 id="review-relations" className={SECTION_TITLE}>
                  Relations ({answer.relations.length})
                </h3>
                {answer.relations.length === 0 && <p className="text-ink-muted">None yet.</p>}
                <ul className="flex flex-col gap-3">
                  {answer.relations.map((r) => (
                    <li key={`${r.type}>${r.to}`}>
                      <p className="font-medium">
                        {r.type} → {titles.get(r.to) ?? r.to}
                      </p>
                      <p>{r.explanation}</p>
                    </li>
                  ))}
                </ul>
              </section>
              {!marked && (
                <div className="flex gap-2">
                  <button type="button" className={SECONDARY} disabled={busy} autoFocus onClick={() => mark(current, "right")}>
                    Right
                  </button>
                  <button type="button" className={SECONDARY} disabled={busy} onClick={() => mark(current, "wrong")}>
                    Wrong
                  </button>
                </div>
              )}
            </div>
          )}

          {marked && (
            <div className="flex flex-col gap-3" role="status" data-testid="review-result">
              <p className={`font-medium tabular-nums ${marked.result === "wrong" ? "text-correction" : ""}`}>
                Marked {marked.result}. {boxLabel(marked.state)}
              </p>
              <div className="flex gap-2">
                {marked.result === "wrong" && (
                  <button type="button" className={SECONDARY} onClick={(e) => onOpenConcept(current.conceptId, e.currentTarget)}>
                    Open concept
                  </button>
                )}
                <button type="button" className={PRIMARY} autoFocus onClick={next}>
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
