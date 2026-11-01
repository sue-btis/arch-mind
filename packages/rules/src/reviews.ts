import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Concept, QuestionState, ReviewLine, RuleError } from "./model.ts";
import { StoreError, loadConcept, loadFacets, localDate } from "./store.ts";

const QUESTION_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*#q[0-9]+$/;
const DATE_TIME = /^(\d{4}-\d{2}-\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:[Zz]|[+-](\d{2}):(\d{2}))$/;

// The contract's date-time format also rejects days and clock times that do not exist, such as 2026-02-30 or 24:00:00.
function isDateTime(value: string): boolean {
  const m = DATE_TIME.exec(value);
  if (!m) return false;
  const [, date, hour, minute, second, offsetHour, offsetMinute] = m;
  const parsed = new Date(`${date}T00:00:00Z`);
  const calendar = !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
  return calendar && +hour! <= 23 && +minute! <= 59 && +second! <= 59 && +(offsetHour ?? 0) <= 23 && +(offsetMinute ?? 0) <= 59;
}

function parseReviewLine(text: string, number: number): ReviewLine {
  const fail = (why: string) => new StoreError(`reviews.jsonl line ${number}: ${why}`);
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw fail("not valid JSON");
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw fail("must be a JSON object");
  const line = value as Record<string, unknown>;
  const extra = Object.keys(line).find((k) => !["question", "at", "result"].includes(k));
  if (extra) throw fail(`unexpected property "${extra}"`);
  if (typeof line.question !== "string" || !QUESTION_PATTERN.test(line.question)) throw fail('"question" must be "<concept id>#<question id>"');
  if (typeof line.at !== "string" || !isDateTime(line.at)) throw fail('"at" must be a date-time');
  if (line.result !== "right" && line.result !== "wrong") throw fail('"result" must be "right" or "wrong"');
  return { question: line.question, at: line.at, result: line.result };
}

export async function loadReviewLines(storePath: string): Promise<ReviewLine[]> {
  let raw: string;
  try {
    raw = await readFile(join(storePath, "reviews.jsonl"), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  return raw
    .split("\n")
    .map((text, i) => ({ text: text.trim(), number: i + 1 }))
    .filter(({ text }) => text !== "")
    .map(({ text, number }) => parseReviewLine(text, number));
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return localDate(new Date(y!, m! - 1, d! + days));
}

// Once reviewed, due counts from the review's local date, not from confirmation.
export function replayQuestionStates(concept: Concept, lines: ReviewLine[], intervalsDays: number[]): QuestionState[] {
  const lastBox = intervalsDays.length;
  return concept.recall.map((q) => {
    const question = `${concept.id}#${q.id}`;
    let box = 1;
    let due = addDays(q.confirmed, 1);
    for (const line of lines) {
      if (line.question !== question) continue;
      box = line.result === "right" ? Math.min(box + 1, lastBox) : 1;
      due = addDays(localDate(new Date(line.at)), intervalsDays[box - 1]!);
    }
    return { question, conceptId: concept.id, text: q.question, box, due };
  });
}

export type ConceptDetailOutcome =
  | { ok: true; concept: Concept; questions: QuestionState[] }
  | { ok: false; errors: RuleError[] };

export async function loadConceptDetail(storePath: string, id: unknown): Promise<ConceptDetailOutcome> {
  const loaded = await loadConcept(storePath, id);
  if (!loaded.ok) return loaded;
  const [{ leitnerIntervalsDays }, lines] = await Promise.all([loadFacets(storePath), loadReviewLines(storePath)]);
  return { ok: true, concept: loaded.concept, questions: replayQuestionStates(loaded.concept, lines, leitnerIntervalsDays) };
}
