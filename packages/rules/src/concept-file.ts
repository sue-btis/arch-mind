import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { SEE_I_PARTS, type Concept, type SeeI, type SeeIPart } from "./model.ts";
import { validateStoredShape } from "./validate.ts";

const HEADINGS: Record<SeeIPart, string> = {
  statement: "## Statement",
  elaboration: "## Elaboration",
  example: "## Example",
  illustration: "## Illustration",
};

export const seeIHeadingLines = new Set(Object.values(HEADINGS));

// Key order follows concept.schema.json so hand diffs stay stable; episodes is
// written only when non-empty (an absent key reads back as []).
export function serializeConcept(concept: Concept): string {
  const front: Record<string, unknown> = {
    id: concept.id,
    title: concept.title,
    layer: concept.layer,
    domains: concept.domains,
    concerns: concept.concerns,
    relations: concept.relations,
  };
  if (concept.episodes.length > 0) front.episodes = concept.episodes;
  front.recall = concept.recall;

  const body = SEE_I_PARTS.map((part) => `${HEADINGS[part]}\n\n${concept.seeI[part]}\n`).join("\n");
  return `---\n${stringifyYaml(front, { lineWidth: 0 })}---\n\n${body}`;
}

export function parseConcept(text: string): Concept {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text);
  if (!match) throw new Error("missing YAML frontmatter delimited by ---");

  let front: unknown;
  try {
    front = parseYaml(match[1] ?? "");
  } catch (error) {
    throw new Error(`frontmatter is not valid YAML: ${(error as Error).message}`, { cause: error });
  }
  if (typeof front !== "object" || front === null || Array.isArray(front)) {
    throw new Error("frontmatter is not a mapping");
  }

  const candidate = { ...(front as Record<string, unknown>), seeI: splitSeeI(match[2] ?? "") };
  const errors = validateStoredShape(candidate);
  if (errors.length > 0) {
    throw new Error(errors.map((e) => `${e.path}: ${e.message}`).join("; "));
  }
  const parsed = candidate as unknown as Concept;
  return { ...parsed, episodes: parsed.episodes ?? [] };
}

function splitSeeI(body: string): Partial<SeeI> {
  const parts: Partial<SeeI> = {};
  let current: SeeIPart | undefined;
  let lines: string[] = [];
  const flush = () => {
    if (current) parts[current] = lines.join("\n").trim();
  };
  for (const line of body.split(/\r?\n/)) {
    const part = SEE_I_PARTS.find((p) => HEADINGS[p] === line);
    if (part) {
      flush();
      current = part;
      lines = [];
    } else {
      lines.push(line);
    }
  }
  flush();
  return parts;
}
