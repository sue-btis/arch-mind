import type { Relation } from "@arch-mind/rules/model";
import type { Neighbourhood } from "./neighbourhood.ts";
import { wireCode, type WireCode } from "./wire-code.ts";

export type Prominence = "selected" | "near" | "far";
// "other" is every type without its own wire color.
export type WireKind = WireCode | "other";

export const wireKind = (type: string): WireKind => wireCode(type) ?? "other";

// A relation stays prominent only when it passes both filters: it touches the selection, and it is of the active legend type.
function relationProminence(hood: Neighbourhood | null, active: WireKind | null, touchesSelection: boolean, typed: boolean): Prominence | undefined {
  if (!hood && !active) return undefined;
  return (!hood || touchesSelection) && (!active || typed) ? "near" : "far";
}

export function wireProminence(hood: Neighbourhood | null, active: WireKind | null, w: { source: string; target: string; label: string }): Prominence | undefined {
  return relationProminence(hood, active, w.source === hood?.id || w.target === hood?.id, wireKind(w.label) === active);
}

export function cellProminence(hood: Neighbourhood | null, active: WireKind | null, row: string, col: string, relations: Relation[]): Prominence | undefined {
  // Without a selection an empty cell has nothing to recede from.
  if (!hood && relations.length === 0) return undefined;
  return relationProminence(hood, active, row === hood?.id || col === hood?.id, relations.some((r) => wireKind(r.type) === active));
}
