import { randomBytes } from "node:crypto";
import { access, link, mkdir, open, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { parseConcept, serializeConcept } from "./concept-file.ts";
import { ID_PATTERN, SEE_I_PARTS, type Concept, type Facets, type FileProblem, type RuleError } from "./model.ts";
import { validateNewConcept } from "./validate.ts";

export class StoreError extends Error {}

export function configFilePath(home: string = homedir()): string {
  return join(home, ".arch-mind", "config.json");
}

export async function loadConfig(file: string = configFilePath()): Promise<{ storePath: string }> {
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch {
    throw new StoreError(`arch-mind is not set up: cannot read ${file}. Run "arch-mind setup <folder>".`);
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new StoreError(`${file} is not valid JSON. Run "arch-mind setup <folder>" again.`);
  }
  const storePath = (value as { storePath?: unknown } | null)?.storePath;
  if (typeof storePath !== "string" || !isAbsolute(storePath)) {
    throw new StoreError(`${file} must hold {"storePath": "<absolute path>"}. Run "arch-mind setup <folder>" again.`);
  }
  return { storePath };
}

const FACETS_SEED = `domains:
  - web
  - mobile
  - models
concerns:
  - security
  - performance
  - reliability
# Provisional default while PRD PD-016 is open; not a decided schedule.
leitnerIntervalsDays: [1, 3, 7, 16, 35]
`;

const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false,
  );

export async function setupStore(folder: string, configFile: string = configFilePath()): Promise<string> {
  const storePath = resolve(folder);
  const facetsFile = join(storePath, "facets.yaml");
  const reviewsFile = join(storePath, "reviews.jsonl");
  for (const file of [facetsFile, reviewsFile]) {
    if (await exists(file)) throw new StoreError(`${file} already exists; setup does not overwrite it.`);
  }
  await mkdir(join(storePath, "concepts"), { recursive: true });
  await writeFile(facetsFile, FACETS_SEED, { flag: "wx" });
  await writeFile(reviewsFile, "", { flag: "wx" });
  await mkdir(dirname(configFile), { recursive: true });
  await writeFile(configFile, `${JSON.stringify({ storePath }, null, 2)}\n`);
  return storePath;
}

export async function loadFacets(storePath: string): Promise<Facets> {
  const file = join(storePath, "facets.yaml");
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch {
    throw new StoreError(`Facet catalog not found: ${file}. Run "arch-mind setup <folder>" or restore the file.`);
  }
  let value: unknown;
  try {
    value = parseYaml(raw);
  } catch (error) {
    throw new StoreError(`${file} is not valid YAML: ${(error as Error).message}`);
  }
  const v = value as Partial<Record<keyof Facets, unknown>> | null;
  const strings = (x: unknown): x is string[] => Array.isArray(x) && x.every((s) => typeof s === "string" && s !== "");
  const days = v?.leitnerIntervalsDays;
  if (
    !strings(v?.domains) ||
    !strings(v?.concerns) ||
    !Array.isArray(days) ||
    days.length === 0 ||
    !days.every((d) => Number.isInteger(d) && d >= 1)
  ) {
    throw new StoreError(
      `${file} must hold domains, concerns (lists of text) and leitnerIntervalsDays (positive integers).`,
    );
  }
  return { domains: v.domains, concerns: v.concerns, leitnerIntervalsDays: days as number[] };
}

async function conceptFileNames(storePath: string): Promise<string[]> {
  const dir = join(storePath, "concepts");
  try {
    const names = await readdir(dir);
    // Temp files start with "." and do not end in ".md", so the loader never sees them.
    return names.filter((n) => n.endsWith(".md") && !n.startsWith(".")).sort();
  } catch {
    throw new StoreError(`Concepts folder not found: ${dir}. Run "arch-mind setup <folder>".`);
  }
}

export async function loadConcepts(storePath: string): Promise<{ concepts: Concept[]; problems: FileProblem[] }> {
  const concepts: Concept[] = [];
  const problems: FileProblem[] = [];
  for (const name of await conceptFileNames(storePath)) {
    try {
      const concept = parseConcept(await readFile(join(storePath, "concepts", name), "utf8"));
      if (`${concept.id}.md` !== name) throw new Error(`id "${concept.id}" does not match the file name`);
      concepts.push(concept);
    } catch (error) {
      problems.push({ file: name, reason: (error as Error).message });
    }
  }
  return { concepts, problems };
}

export class DuplicateIdError extends Error {}

export async function writeConceptAtomic(
  storePath: string,
  concept: Concept,
  beforeRename?: () => void | Promise<void>,
): Promise<string> {
  const dir = join(storePath, "concepts");
  const finalFile = join(dir, `${concept.id}.md`);
  const tempFile = join(dir, `.${concept.id}.md.${randomBytes(6).toString("hex")}.tmp`);
  try {
    const handle = await open(tempFile, "wx");
    try {
      await handle.writeFile(serializeConcept(concept), "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await beforeRename?.();
    // link fails with EEXIST instead of replacing, so two saves of one id can never overwrite each other
    // (rename would replace silently).
    try {
      await link(tempFile, finalFile);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new DuplicateIdError(concept.id);
      throw error;
    }
  } finally {
    await unlink(tempFile).catch(() => {});
  }
  return finalFile;
}

export interface SaveOptions {
  today?: string;
  beforeRename?: () => void | Promise<void>;
}

export type SaveOutcome =
  | { ok: true; id: string; file: string; recall: { id: string; confirmed: string }[] }
  | { ok: false; errors: RuleError[] };

export function localDate(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export async function saveConcept(storePath: string, input: unknown, options: SaveOptions = {}): Promise<SaveOutcome> {
  const facets = await loadFacets(storePath);
  const { concepts } = await loadConcepts(storePath);
  const existingIds = new Set(concepts.map((c) => c.id));
  for (const name of await conceptFileNames(storePath)) {
    const stem = basename(name, ".md");
    if (ID_PATTERN.test(stem)) existingIds.add(stem);
  }

  const errors = validateNewConcept(input, { existingIds, facets });
  if (errors.length > 0) return { ok: false, errors };

  const draft = input as Omit<Concept, "recall" | "episodes"> & {
    recall: { question: string }[];
    episodes?: Concept["episodes"];
  };
  const confirmed = options.today ?? localDate();
  const recall = draft.recall.map((q, i) => ({ id: `q${i + 1}`, question: q.question, confirmed }));
  const seeI = Object.fromEntries(SEE_I_PARTS.map((p) => [p, draft.seeI[p].trim()])) as Concept["seeI"];
  const concept: Concept = {
    id: draft.id,
    title: draft.title,
    layer: draft.layer,
    domains: draft.domains,
    concerns: draft.concerns,
    seeI,
    relations: draft.relations,
    episodes: draft.episodes ?? [],
    recall,
  };

  try {
    const file = await writeConceptAtomic(storePath, concept, options.beforeRename);
    return { ok: true, id: concept.id, file, recall: recall.map(({ id, confirmed }) => ({ id, confirmed })) };
  } catch (error) {
    if (error instanceof DuplicateIdError) {
      return {
        ok: false,
        errors: [{ path: "/id", rule: "duplicate_id", message: `a concept "${concept.id}" already exists` }],
      };
    }
    throw error;
  }
}
