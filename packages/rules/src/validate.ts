import {
  ID_PATTERN,
  LAYERS,
  SEE_I_PARTS,
  type Concept,
  type Facets,
  type RejectionRule,
  type RuleError,
} from "./model.ts";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
// The contract's `format: date` also rejects days that do not exist, such as 2026-02-30.
const isCalendarDate = (v: unknown): v is string => {
  if (typeof v !== "string" || !DATE_PATTERN.test(v)) return false;
  const parsed = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === v;
};
const SEE_I_HEADINGS = new Set(["## Statement", "## Elaboration", "## Example", "## Illustration"]);

type Obj = Record<string, unknown>;

const isObject = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isBlank = (v: unknown): boolean => typeof v !== "string" || v.trim() === "";
const isId = (v: unknown): v is string => typeof v === "string" && ID_PATTERN.test(v);

function collector() {
  const errors: RuleError[] = [];
  const add = (path: string, rule: RejectionRule, message: string) => errors.push({ path, rule, message });
  return { errors, add };
}

type Add = ReturnType<typeof collector>["add"];

function rejectUnknownKeys(value: Obj, allowed: readonly string[], base: string, add: Add) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) add(`${base}/${key}`, "invalid_shape", `unknown field "${key}"`);
  }
}

function checkStringList(value: unknown, path: string, add: Add, onItem?: (item: string, i: number) => void) {
  if (!Array.isArray(value)) {
    add(path, "invalid_shape", "must be an array of strings");
    return;
  }
  const seen = new Set<string>();
  value.forEach((item, i) => {
    if (isBlank(item)) return add(`${path}/${i}`, "invalid_shape", "must be a non-empty string");
    if (seen.has(item as string)) return add(`${path}/${i}`, "invalid_shape", "duplicate value");
    seen.add(item as string);
    onItem?.(item as string, i);
  });
}

function checkEpisodes(value: unknown, add: Add) {
  if (value === undefined) return;
  if (!Array.isArray(value)) return add("/episodes", "invalid_shape", "must be an array");
  value.forEach((ep, i) => {
    const base = `/episodes/${i}`;
    if (!isObject(ep)) return add(base, "invalid_shape", "must be an object");
    rejectUnknownKeys(ep, ["project", "situation", "date"], base, add);
    for (const key of ["project", "situation"]) {
      if (isBlank(ep[key])) add(`${base}/${key}`, "invalid_shape", "must be a non-empty string");
    }
    if (ep.date !== undefined && !isCalendarDate(ep.date)) {
      add(`${base}/date`, "invalid_shape", "must be a YYYY-MM-DD date");
    }
  });
}

// A SEE-I part holding a heading line would split differently on read.
function checkSeeIText(seeI: Obj, add: Add) {
  for (const part of SEE_I_PARTS) {
    const text = seeI[part];
    if (typeof text === "string" && text.split(/\r?\n/).some((line) => SEE_I_HEADINGS.has(line))) {
      add(`/seeI/${part}`, "invalid_shape", "must not contain a line equal to a SEE-I heading");
    }
  }
}

export interface SaveContext {
  existingIds: ReadonlySet<string>;
  facets: Pick<Facets, "domains" | "concerns">;
}

const CONCEPT_KEYS = ["id", "title", "layer", "domains", "concerns", "seeI", "relations", "episodes", "recall"];
const RELATION_KEYS = ["type", "to", "source", "explanation"];

export function validateNewConcept(input: unknown, ctx: SaveContext): RuleError[] {
  const { errors, add } = collector();
  if (!isObject(input)) {
    add("", "invalid_shape", "arguments must be an object");
    return errors;
  }
  rejectUnknownKeys(input, CONCEPT_KEYS, "", add);

  if (!isId(input.id)) add("/id", "invalid_shape", "must be a lowercase kebab-case id");
  else if (ctx.existingIds.has(input.id)) add("/id", "duplicate_id", `a concept "${input.id}" already exists`);

  if (isBlank(input.title)) add("/title", "invalid_shape", "must be a non-empty string");
  if (!(LAYERS as readonly string[]).includes(input.layer as string)) {
    add("/layer", "invalid_shape", `must be one of ${LAYERS.join(", ")}`);
  }

  for (const key of ["domains", "concerns"] as const) {
    checkStringList(input[key], `/${key}`, add, (item, i) => {
      if (!ctx.facets[key].includes(item)) add(`/${key}/${i}`, "unknown_facet", `"${item}" is not in the facet catalog`);
    });
  }

  if (input.seeI !== undefined && !isObject(input.seeI)) add("/seeI", "invalid_shape", "must be an object");
  const seeI = isObject(input.seeI) ? input.seeI : {};
  rejectUnknownKeys(seeI, SEE_I_PARTS, "/seeI", add);
  for (const part of SEE_I_PARTS) {
    if (isBlank(seeI[part])) add(`/seeI/${part}`, "incomplete_see_i", `SEE-I ${part} is missing or empty`);
  }
  checkSeeIText(seeI, add);

  checkNewRelations(input.relations, input.id, ctx, add);
  checkEpisodes(input.episodes, add);

  if (!Array.isArray(input.recall) || input.recall.length === 0) {
    add("/recall", "no_recall", "at least one recall question is required");
  } else {
    checkNewRecall(input.recall, add);
  }
  return errors;
}

function checkNewRecall(items: unknown[], add: Add) {
  items.forEach((item, i) => {
    if (!isObject(item)) return add(`/recall/${i}`, "invalid_shape", "must be an object");
    rejectUnknownKeys(item, ["question"], `/recall/${i}`, add);
    if (isBlank(item.question)) add(`/recall/${i}/question`, "invalid_shape", "must be a non-empty string");
  });
}

export interface ExtendContext {
  stored: Concept;
  existingIds: ReadonlySet<string>;
}

const EXTEND_KEYS = ["id", "relations", "episodes", "recall"];

export function validateExtension(input: unknown, ctx: ExtendContext): RuleError[] {
  const { errors, add } = collector();
  if (!isObject(input)) {
    add("", "invalid_shape", "arguments must be an object");
    return errors;
  }
  rejectUnknownKeys(input, EXTEND_KEYS, "", add);

  if (input.relations !== undefined) {
    const stored = ctx.stored.relations.map((r) => relationKey(r.type, r.to));
    checkNewRelations(input.relations, ctx.stored.id, ctx, add, stored);
  }
  checkEpisodes(input.episodes, add);
  if (input.recall !== undefined) {
    if (Array.isArray(input.recall)) checkNewRecall(input.recall, add);
    else add("/recall", "invalid_shape", "must be an array");
  }

  const hasItems = ["relations", "episodes", "recall"].some((k) => Array.isArray(input[k]) && input[k].length > 0);
  if (!hasItems) add("", "nothing_to_add", "add at least one relation, episode or recall question");
  return errors;
}

const relationKey = (type: string, to: string) => `${type}\n${to}`;

function checkNewRelations(
  relations: unknown,
  ownId: unknown,
  ctx: Pick<SaveContext, "existingIds">,
  add: Add,
  alreadyStored: readonly string[] = [],
) {
  if (!Array.isArray(relations)) return add("/relations", "invalid_shape", "must be an array");
  const seen = new Set<string>(alreadyStored);
  relations.forEach((rel, i) => {
    const base = `/relations/${i}`;
    if (!isObject(rel)) return add(base, "invalid_shape", "must be an object");
    rejectUnknownKeys(rel, RELATION_KEYS, base, add);
    if (isBlank(rel.type)) add(`${base}/type`, "invalid_shape", "must be a non-empty string");
    if (isBlank(rel.explanation)) add(`${base}/explanation`, "invalid_shape", "must be a non-empty string");
    if (isBlank(rel.source)) add(`${base}/source`, "missing_source", "every relation needs a source");
    if (isBlank(rel.to)) add(`${base}/to`, "missing_target", "every relation needs a target concept");
    else if (!isId(rel.to)) add(`${base}/to`, "invalid_shape", "must be a lowercase kebab-case id");
    else if (rel.to === ownId || !ctx.existingIds.has(rel.to)) {
      add(`${base}/to`, "missing_target", `no stored concept "${rel.to}"`);
    }
    if (typeof rel.type === "string" && typeof rel.to === "string") {
      const key = relationKey(rel.type, rel.to);
      if (seen.has(key)) add(base, "duplicate_relation", `relation "${rel.type}" to "${rel.to}" is repeated`);
      seen.add(key);
    }
  });
}

export function validateStoredShape(value: unknown): RuleError[] {
  const { errors, add } = collector();
  if (!isObject(value)) {
    add("", "invalid_shape", "must be an object");
    return errors;
  }
  rejectUnknownKeys(value, CONCEPT_KEYS, "", add);
  if (!isId(value.id)) add("/id", "invalid_shape", "must be a lowercase kebab-case id");
  if (isBlank(value.title)) add("/title", "invalid_shape", "must be a non-empty string");
  if (!(LAYERS as readonly string[]).includes(value.layer as string)) add("/layer", "invalid_shape", "unknown layer");
  checkStringList(value.domains, "/domains", add);
  checkStringList(value.concerns, "/concerns", add);

  if (!isObject(value.seeI)) add("/seeI", "invalid_shape", "must be an object");
  else {
    for (const part of SEE_I_PARTS) {
      if (isBlank(value.seeI[part])) add(`/seeI/${part}`, "incomplete_see_i", `SEE-I ${part} is missing or empty`);
    }
  }

  if (!Array.isArray(value.relations)) add("/relations", "invalid_shape", "must be an array");
  else {
    value.relations.forEach((rel, i) => {
      const base = `/relations/${i}`;
      if (!isObject(rel)) return add(base, "invalid_shape", "must be an object");
      rejectUnknownKeys(rel, RELATION_KEYS, base, add);
      if (isBlank(rel.type) || isBlank(rel.explanation) || !isId(rel.to)) {
        add(base, "invalid_shape", "type, to and explanation are required");
      }
      if (isBlank(rel.source)) add(`${base}/source`, "missing_source", "every relation needs a source");
    });
  }
  checkEpisodes(value.episodes, add);

  if (!Array.isArray(value.recall) || value.recall.length === 0) {
    add("/recall", "no_recall", "at least one recall question is required");
  } else {
    value.recall.forEach((q, i) => {
      const base = `/recall/${i}`;
      if (!isObject(q)) return add(base, "invalid_shape", "must be an object");
      rejectUnknownKeys(q, ["id", "question", "confirmed"], base, add);
      if (!(typeof q.id === "string" && /^q[0-9]+$/.test(q.id))) add(`${base}/id`, "invalid_shape", "must look like q1");
      if (isBlank(q.question)) add(`${base}/question`, "invalid_shape", "must be a non-empty string");
      if (!isCalendarDate(q.confirmed)) {
        add(`${base}/confirmed`, "invalid_shape", "must be a YYYY-MM-DD date");
      }
    });
  }
  return errors;
}
