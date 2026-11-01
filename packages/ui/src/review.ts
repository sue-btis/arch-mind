import type { QuestionState } from "@arch-mind/rules/model";

export function dueHeading(count: number): string {
  if (count === 0) return "Nothing is due today.";
  return count === 1 ? "1 question due" : `${count} questions due`;
}

export function boxLabel(state: Pick<QuestionState, "box" | "due">): string {
  return `Box ${state.box} · due ${state.due}`;
}
