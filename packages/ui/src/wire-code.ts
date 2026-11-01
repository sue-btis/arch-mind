export type WireCode = "requires" | "complements" | "contains" | "alternative";

const CODES: Record<string, WireCode> = {
  requires: "requires",
  complements: "complements",
  contains: "contains",
  "alternative to": "alternative",
};

export const WIRE_LEGEND: { code: WireCode; type: string }[] = [
  { code: "requires", type: "requires" },
  { code: "complements", type: "complements" },
  { code: "contains", type: "contains" },
  { code: "alternative", type: "alternative to" },
];

// Color alone cannot carry the relation type on the board, so every coded wire also gets a short letter code.
const ABBREV: Record<WireCode, string> = { requires: "rq", complements: "cp", contains: "ct", alternative: "alt" };

export const wireAbbrev = (code: WireCode): string => ABBREV[code];

// Relation types are free text, so only the exact core verbs get a wire color; every other type stays graphite.
export function wireCode(type: string): WireCode | null {
  return CODES[type.trim().toLowerCase().replace(/\s+/g, " ")] ?? null;
}

// An alternative is not a dependency, so it is drawn as a dashed graphite wire instead of a fourth hue.
export function wireStyle(code: WireCode | null): { stroke: string; strokeDasharray?: string } {
  if (code === "alternative") return { stroke: "var(--wire)", strokeDasharray: "5 4" };
  return { stroke: code ? `var(--wire-${code})` : "var(--wire)" };
}
