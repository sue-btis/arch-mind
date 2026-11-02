import type { Concept } from "@arch-mind/rules/model";
import { neighbourhood } from "./neighbourhood.ts";

// The M06 neighbourhood as a set of concepts to draw; a selection the filters hide has no neighbourhood, so nothing is drawn.
export function focusedConcepts(shown: Concept[], id: string): Concept[] {
  const hood = neighbourhood(shown, id);
  if (!hood) return [];
  const keep = new Set([id, ...hood.connected]);
  return shown.filter((c) => keep.has(c.id));
}
