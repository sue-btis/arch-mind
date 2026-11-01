import { PICTOGRAMS, extendConcept, loadConcept, loadConcepts, loadFacets, saveConcept } from "@arch-mind/rules";

const idSchema = { type: "string", pattern: "^[a-z0-9]+(-[a-z0-9]+)*$" };
const text = { type: "string", minLength: 1 };
const layers = ["client", "network", "server", "data"];
const relationSchema = {
  type: "object",
  additionalProperties: false,
  required: ["type", "to", "source", "explanation"],
  properties: { type: text, to: idSchema, source: text, explanation: text },
} as const;
const episodeSchema = {
  type: "object",
  additionalProperties: false,
  required: ["project", "situation"],
  properties: { project: text, situation: text, date: { type: "string", format: "date" } },
} as const;
const newRecallSchema = {
  type: "object",
  additionalProperties: false,
  required: ["question"],
  properties: { question: text },
} as const;

// Resolved copy of docs/design/api/capture-tools.schema.json: tools/list must be self-contained.
// extend_concept omits the contract's minProperties and minItems on purpose, so an empty call
// reaches the server and is rejected as nothing_to_add instead of failing client-side validation.
export const toolDefinitions = [
  {
    name: "list_concepts",
    description:
      "Existing concepts and facet values, so Claude can propose relation targets and facets. Call it once before save_concept.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
  },
  {
    name: "save_concept",
    description:
      "Creates a new concept from what the author confirmed. Rejects without writing when any rule fails and names every failed rule with its path.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["id", "title", "layer", "domains", "concerns", "seeI", "relations", "recall"],
      properties: {
        id: idSchema,
        title: text,
        layer: { enum: layers },
        domains: { type: "array", items: { type: "string" }, uniqueItems: true },
        concerns: { type: "array", items: { type: "string" }, uniqueItems: true },
        seeI: {
          type: "object",
          additionalProperties: false,
          required: ["statement", "elaboration", "example", "illustration"],
          properties: { statement: text, elaboration: text, example: text, illustration: text },
        },
        relations: { type: "array", items: relationSchema },
        episodes: { type: "array", items: episodeSchema },
        recall: { type: "array", minItems: 1, items: newRecallSchema },
      },
    },
  },
  {
    name: "get_concept",
    description: "One stored concept, so a capture can extend it without duplicating what exists.",
    inputSchema: { type: "object", additionalProperties: false, required: ["id"], properties: { id: idSchema } },
  },
  {
    name: "extend_concept",
    description:
      "Adds relations, recall questions or episodes to an existing concept. Additive only: never changes or removes stored fields. Rejects without writing when a rule fails, including a call that adds nothing.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["id"],
      properties: {
        id: idSchema,
        relations: { type: "array", items: relationSchema },
        episodes: { type: "array", items: episodeSchema },
        recall: { type: "array", items: newRecallSchema },
      },
    },
  },
] as const;

export interface ToolOutcome {
  structured: Record<string, unknown>;
  isError: boolean;
}

export async function runTool(storePath: string, name: string, args: unknown): Promise<ToolOutcome | null> {
  if (name === "list_concepts") {
    const [{ concepts }, { domains, concerns }] = await Promise.all([loadConcepts(storePath), loadFacets(storePath)]);
    return {
      isError: false,
      structured: {
        concepts: concepts.map(({ id, title, layer, pictogram, hasIllustration, domains, concerns }) => ({
          id,
          title,
          layer,
          ...(pictogram !== undefined && { pictogram }),
          hasIllustration,
          domains,
          concerns,
        })),
        facets: { domains, concerns },
        pictograms: PICTOGRAMS,
      },
    };
  }
  if (name === "save_concept") {
    const outcome = await saveConcept(storePath, args ?? {});
    if (!outcome.ok) return { isError: true, structured: { errors: outcome.errors } };
    const { id, file, recall } = outcome;
    return { isError: false, structured: { id, file, recall } };
  }
  if (name === "get_concept") {
    const outcome = await loadConcept(storePath, (args as { id?: unknown } | null)?.id);
    if (!outcome.ok) return { isError: true, structured: { errors: outcome.errors } };
    return { isError: false, structured: { ...outcome.concept } };
  }
  if (name === "extend_concept") {
    const outcome = await extendConcept(storePath, args ?? {});
    if (!outcome.ok) return { isError: true, structured: { errors: outcome.errors } };
    const { id, file, recall } = outcome;
    return { isError: false, structured: { id, file, recall } };
  }
  return null;
}
