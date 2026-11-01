import { open, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Concept, QuestionState, ReviewLine, RuleError } from "./model.ts";
import { StoreError, loadConcept, loadConcepts, loadFacets, localDate } from "./store.ts";

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

// Append mode and one write per line. Only the last byte is read, so a hand-edited log without a final newline
// does not merge with the new line; earlier bytes are never rewritten.
export async function appendReviewLine(storePath: string, line: ReviewLine): Promise<void> {
  const handle = await open(join(storePath, "reviews.jsonl"), "a+");
  try {
    const { size } = await handle.stat();
    const last = Buffer.alloc(1);
    if (size > 0) await handle.read(last, 0, 1, size - 1);
    const separator = size > 0 && last[0] !== 0x0a ? "\n" : "";
    await handle.write(`${separator}${JSON.stringify({ question: line.question, at: line.at, result: line.result })}\n`);
  } finally {
    await handle.close();
  }
}

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const questionNumber = (s: QuestionState) => Number(s.question.slice(s.conceptId.length + 2));

export function selectDue(states: QuestionState[], today: string): QuestionState[] {
  return states
    .filter((s) => s.due <= today)
    .sort((a, b) => compare(a.due, b.due) || compare(a.conceptId, b.conceptId) || questionNumber(a) - questionNumber(b));
}

export async function loadDueQuestions(storePath: string, today: string = localDate()): Promise<QuestionState[]> {
  const [{ concepts }, { leitnerIntervalsDays }, lines] = await Promise.all([
    loadConcepts(storePath),
    loadFacets(storePath),
    loadReviewLines(storePath),
  ]);
  return selectDue(
    concepts.flatMap((c) => replayQuestionStates(c, lines, leitnerIntervalsDays)),
    today,
  );
}

export interface ReviewRequest {
  question: string;
  result: ReviewLine["result"];
}

export function parseReviewRequest(body: unknown): { ok: true; request: ReviewRequest } | { ok: false; message: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return { ok: false, message: "body must be a JSON object" };
  const value = body as Record<string, unknown>;
  const extra = Object.keys(value).find((k) => k !== "question" && k !== "result");
  if (extra) return { ok: false, message: `unexpected property "${extra}"` };
  if (typeof value.question !== "string" || !QUESTION_PATTERN.test(value.question)) {
    return { ok: false, message: '"question" must be "<concept id>#<question id>"' };
  }
  if (value.result !== "right" && value.result !== "wrong") return { ok: false, message: '"result" must be "right" or "wrong"' };
  return { ok: true, request: { question: value.question, result: value.result } };
}

export type RecordOutcome = { ok: true; state: QuestionState } | { ok: false; message: string };

export async function recordReview(storePath: string, request: ReviewRequest, now: Date = new Date()): Promise<RecordOutcome> {
  const [conceptId, recallId] = request.question.split("#") as [string, string];
  const loaded = await loadConcept(storePath, conceptId);
  if (!loaded.ok) return { ok: false, message: loaded.errors[0]!.message };
  if (!loaded.concept.recall.some((q) => q.id === recallId)) return { ok: false, message: `no recall question "${request.question}"` };

  // Read the log first: a malformed one must fail the request before anything is appended to it.
  const [{ leitnerIntervalsDays }, lines] = await Promise.all([loadFacets(storePath), loadReviewLines(storePath)]);
  const line: ReviewLine = { question: request.question, at: now.toISOString(), result: request.result };
  await appendReviewLine(storePath, line);
  const state = replayQuestionStates(loaded.concept, [...lines, line], leitnerIntervalsDays).find((s) => s.question === request.question)!;
  return { ok: true, state };
}
