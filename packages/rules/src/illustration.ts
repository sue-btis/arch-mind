import { randomBytes } from "node:crypto";
import { mkdir, open, readFile, rename, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import type { Concept } from "./model.ts";
import { validateSvg } from "./svg-allowlist.ts";

const IMAGE_LINK = /!\[[^\]]*\]\(([^)]*)\)/g;

export const illustrationLinks = (text: string): string[] => [...text.matchAll(IMAGE_LINK)].map((m) => (m[1] ?? "").trim());

export const illustrationFile = (storePath: string, id: string): string => join(storePath, "illustrations", `${id}.svg`);

// The concept file lives in concepts/, so the link climbs one level to stay clickable in a Markdown viewer.
export function appendIllustrationLink(text: string, id: string, title: string): string {
  const alt = `Illustration of ${title}`.replace(/[[\]\\\r\n]/g, " ");
  return `${text.trimEnd()}\n\n![${alt}](../illustrations/${id}.svg)`;
}

export const stripIllustrationLinks = (text: string): string => text.replace(IMAGE_LINK, "").replace(/\n{3,}/g, "\n\n").trim();

export const withoutIllustrationLink = (concept: Concept): Concept => ({
  ...concept,
  seeI: { ...concept.seeI, illustration: stripIllustrationLinks(concept.seeI.illustration) },
});

const isExpectedTarget = (id: string, target: string) => target === `../illustrations/${id}.svg` || target === `illustrations/${id}.svg`;

// Validation results are cached per file by mtime and size, so a changed or removed SVG is noticed on the next load
// while an unchanged one is not read again.
const svgChecks = new Map<string, { mtimeMs: number; size: number; reasons: string[] }>();

const SHOWN_WITHOUT = "the concept is shown without its illustration";

export type IllustrationState = { ok: true } | { ok: false; problem?: string };

async function svgReasons(storePath: string, id: string): Promise<string[] | "missing"> {
  const file = illustrationFile(storePath, id);
  let info;
  try {
    info = await stat(file);
  } catch (error) {
    svgChecks.delete(file);
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "missing";
    throw error;
  }
  const cached = svgChecks.get(file);
  if (cached && cached.mtimeMs === info.mtimeMs && cached.size === info.size) return cached.reasons;
  const reasons = validateSvg(await readFile(file, "utf8"));
  svgChecks.set(file, { mtimeMs: info.mtimeMs, size: info.size, reasons });
  return reasons;
}

// Only exactly one link to illustrations/<id>.svg holding a valid SVG counts (ADR-009); a concept with no link has no problem to report.
export async function inspectIllustration(storePath: string, concept: Concept): Promise<IllustrationState> {
  const links = illustrationLinks(concept.seeI.illustration);
  if (links.length === 0) return { ok: false };
  if (links.length > 1) return { ok: false, problem: `${links.length} illustration links; ${SHOWN_WITHOUT}` };
  if (!isExpectedTarget(concept.id, links[0]!)) {
    return { ok: false, problem: `the illustration link must point to illustrations/${concept.id}.svg; ${SHOWN_WITHOUT}` };
  }
  const reasons = await svgReasons(storePath, concept.id);
  if (reasons === "missing") return { ok: false, problem: `illustrations/${concept.id}.svg is missing; ${SHOWN_WITHOUT}` };
  if (reasons.length > 0) return { ok: false, problem: `illustrations/${concept.id}.svg is not a valid SVG (${reasons[0]}); ${SHOWN_WITHOUT}` };
  return { ok: true };
}

// Bytes are read and validated together on every call so the endpoint never serves a file that changed after its check.
export async function readValidSvg(storePath: string, id: string): Promise<{ ok: true; svg: string } | { ok: false }> {
  try {
    const svg = await readFile(illustrationFile(storePath, id), "utf8");
    return validateSvg(svg).length === 0 ? { ok: true, svg } : { ok: false };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { ok: false };
    throw error;
  }
}

export async function writeIllustrationAtomic(
  storePath: string,
  id: string,
  svg: string,
  beforeRename?: () => void | Promise<void>,
): Promise<string> {
  const dir = join(storePath, "illustrations");
  await mkdir(dir, { recursive: true });
  const finalFile = illustrationFile(storePath, id);
  const tempFile = join(dir, `.${id}.svg.${randomBytes(6).toString("hex")}.tmp`);
  try {
    const handle = await open(tempFile, "wx");
    try {
      await handle.writeFile(svg, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await beforeRename?.();
    // rename replaces, so a retry of an interrupted save overwrites its own orphan (ADR-009).
    await rename(tempFile, finalFile);
  } finally {
    await unlink(tempFile).catch(() => {});
  }
  return finalFile;
}
