import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { tst032Concepts, tst032RelationCount } from "@arch-mind/rules/fixtures";
import { PICTOGRAMS, setupStore, writeConceptAtomic } from "@arch-mind/rules";
import { startServer, type RunningServer } from "../src/app.ts";

const uiDir = fileURLToPath(new URL("../../ui/dist", import.meta.url));
const shotDir = process.env.ARCH_MIND_SCREENSHOT_DIR;
const VIEWPORT = { width: 1366, height: 768 };
const FLOOR = 0.85;

let dir: string;
let running: RunningServer;
let unknownPictogram: RunningServer;
let browser: Browser;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "arch-mind-e2e-"));
  const store = await setupStore(join(dir, "store"), join(dir, "config.json"));
  for (const concept of tst032Concepts) await writeConceptAtomic(store, concept);
  running = await startServer({ storePath: store, uiDir, port: 0 });

  const handEdited = await setupStore(join(dir, "hand-edited"), join(dir, "hand-edited-config.json"));
  const [first, second] = tst032Concepts;
  await writeConceptAtomic(handEdited, { ...first!, relations: [], pictogram: "no-such-picture" });
  await writeConceptAtomic(handEdited, { ...second!, relations: [], pictogram: undefined });
  unknownPictogram = await startServer({ storePath: handEdited, uiDir, port: 0 });

  // Uses the installed Chrome: no browser is downloaded.
  browser = await chromium.launch({ channel: "chrome" });
});

afterAll(async () => {
  await browser?.close();
  await running?.close();
  await unknownPictogram?.close();
  await rm(dir, { recursive: true, force: true });
});

async function open(server: RunningServer, scheme: "light" | "dark") {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, colorScheme: scheme });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${server.port}/`);
  await page.getByTestId("plates").waitFor();
  await page.getByTestId("concept").first().waitFor();
  return { page, close: () => context.close() };
}

async function screenshot(page: Page, name: string) {
  if (!shotDir) return;
  await mkdir(shotDir, { recursive: true });
  await page.screenshot({ path: join(shotDir, name), fullPage: true, animations: "disabled" });
}

describe.each(["light", "dark"] as const)("layer plates at 1366 x 768, %s mode (TST-023, AC-024, AC-025, AC-026, AC-028)", (scheme) => {
  it("stacks four plates with every concept's pictogram, labeled wires, readable sizes and no horizontal overflow", async () => {
    const { page, close } = await open(running, scheme);
    try {
      await page.waitForFunction((n) => document.querySelectorAll('[data-testid="wire"]').length === n, tst032RelationCount);
      await page.waitForTimeout(400);

      const m = await page.evaluate(() => {
        const svg = document.querySelector('[data-testid="plates"]') as SVGSVGElement;
        const screenScale = (el: SVGGraphicsElement) => el.getScreenCTM()!.a;
        const plates = [...document.querySelectorAll("[data-plate]")].map((p) => ({
          layer: p.getAttribute("data-plate"),
          top: p.getBoundingClientRect().top,
          label: p.getAttribute("aria-label"),
          pictogram: p.querySelector("use")?.getAttribute("href"),
        }));
        const concepts = [...document.querySelectorAll('[data-testid="concept"]')].map((c) => {
          const text = c.querySelector(".nlab") as SVGTextElement;
          const use = c.querySelector("use") as SVGUseElement;
          return {
            name: c.getAttribute("aria-label"),
            pictogram: c.getAttribute("data-pictogram"),
            href: use.getAttribute("href"),
            title: c.querySelector("title")?.textContent,
            labelPx: Number.parseFloat(getComputedStyle(text).fontSize) * screenScale(text),
            pictogramPx: use.width.baseVal.value * screenScale(use),
          };
        });
        const chips = [...document.querySelectorAll(".chips text")].map((t) => ({
          text: t.textContent,
          px: Number.parseFloat(getComputedStyle(t).fontSize) * screenScale(t as SVGTextElement),
        }));
        const root = document.documentElement;
        const board = document.querySelector('[data-testid="board"]')!.getBoundingClientRect();
        return {
          scrollWidth: root.scrollWidth,
          clientWidth: root.clientWidth,
          fitMessages: document.querySelectorAll('[data-testid="fit-message"]').length,
          scale: Number(svg.getAttribute("data-fit-scale")),
          projectedWidth: Number(svg.getAttribute("data-projected-width")),
          svgRight: svg.getBoundingClientRect().right,
          boardRight: board.right,
          plates,
          concepts,
          chips,
          wires: document.querySelectorAll('[data-testid="wire"]').length,
          listConcepts: document.querySelectorAll('[data-testid="concept-list"] li > button').length,
          fonts: getComputedStyle(document.body).fontFamily,
        };
      });
      process.stdout.write(`${scheme}: Fit scale ${m.scale}, projected width ${m.projectedWidth} px, scrollWidth=${m.scrollWidth} clientWidth=${m.clientWidth}\n`);

      expect(m.scale).toBeGreaterThanOrEqual(FLOOR);
      expect(m.scrollWidth).toBeLessThanOrEqual(m.clientWidth);
      expect(m.svgRight).toBeLessThanOrEqual(m.boardRight);
      expect(m.fitMessages).toBe(0);
      expect(m.fonts).toContain("Inter");

      expect(m.plates.map((p) => p.layer)).toEqual(["client", "network", "server", "data"]);
      for (let i = 1; i < m.plates.length; i++) expect(m.plates[i]!.top).toBeGreaterThan(m.plates[i - 1]!.top);
      expect(m.plates.map((p) => p.pictogram)).toEqual(["#client", "#network", "#server", "#data"]);
      for (const p of m.plates) expect(p.label).toContain("layer");

      expect(m.concepts).toHaveLength(13);
      for (const c of m.concepts) {
        const expected = tst032Concepts.find((t) => c.name!.endsWith(t.title))!;
        expect(c.pictogram, c.name!).toBe(expected.pictogram);
        expect(c.href).toBe(`#${expected.pictogram}`);
        const meaning = PICTOGRAMS.find((p) => p.id === expected.pictogram)!.meaning;
        expect(c.title).toContain(meaning);
        expect(c.labelPx).toBeGreaterThanOrEqual(11);
        expect(c.pictogramPx).toBeGreaterThanOrEqual(32);
      }
      expect(m.wires).toBe(tst032RelationCount);
      expect(m.chips.map((c) => c.text)).toContain("requires");
      expect(m.chips.map((c) => c.text)).toContain("complements");
      for (const chip of m.chips) expect(chip.px).toBeGreaterThanOrEqual(11);
      expect(m.listConcepts).toBe(13);

      await screenshot(page, `layer-plates-1366x768-${scheme}.png`);
    } finally {
      await close();
    }
  });
});

describe("zoom and Fit (TST-023, AC-027)", () => {
  it("zooms in on the plates and returns to Fit", async () => {
    const { page, close } = await open(running, "light");
    try {
      const view = () => page.getByTestId("plates").evaluate((svg) => (svg as SVGSVGElement).viewBox.baseVal.width);
      const value = () => page.getByTestId("zoom-value").textContent();
      const fitWidth = await view();
      const fitValue = await value();
      const fit = page.getByRole("button", { name: "Fit", exact: true });
      expect(await fit.isDisabled()).toBe(true);

      await page.getByRole("button", { name: "Zoom in" }).click();
      await page.getByRole("button", { name: "Zoom in" }).click();
      expect(await view()).toBeCloseTo(fitWidth / 2, 1);
      expect(await value()).not.toBe(fitValue);
      expect(await fit.isDisabled()).toBe(false);
      await page.waitForTimeout(400);
      await screenshot(page, "layer-plates-zoomed-1366x768-light.png");

      await page.getByRole("button", { name: "Zoom out" }).click();
      expect(await view()).toBeCloseTo(fitWidth / 1.5, 1);
      await fit.click();
      expect(await view()).toBeCloseTo(fitWidth, 1);
      expect(await value()).toBe(fitValue);
      expect(await fit.isDisabled()).toBe(true);
    } finally {
      await close();
    }
  });

  it("brings a focused concept into view when zoomed in", async () => {
    const { page, close } = await open(running, "light");
    try {
      await page.getByRole("button", { name: "Zoom in" }).click();
      await page.getByRole("button", { name: "Zoom in" }).click();
      await page.getByRole("button", { name: "Zoom in" }).click();
      const last = page.getByTestId("concept").last();
      await last.focus();
      const inside = await last.evaluate((el) => {
        const svg = (el as SVGGraphicsElement).ownerSVGElement!.getBoundingClientRect();
        const box = el.getBoundingClientRect();
        return box.left >= svg.left - 1 && box.right <= svg.right + 1 && box.top >= svg.top - 1 && box.bottom <= svg.bottom + 1;
      });
      expect(inside).toBe(true);
    } finally {
      await close();
    }
  });
});

describe("accessible list of concepts and relations (TST-023, AC-028)", () => {
  it("is reachable by keyboard, lists every concept and relation, and opens a concept", async () => {
    const { page, close } = await open(running, "light");
    try {
      const list = page.getByTestId("concept-list");
      const summary = list.locator("summary");
      await summary.focus();
      await page.keyboard.press("Enter");
      expect(await list.evaluate((el) => (el as HTMLDetailsElement).open)).toBe(true);
      expect(await list.locator("li > button").count()).toBe(13);
      expect(await list.locator("ul ul li").count()).toBe(tst032RelationCount);
      expect(await list.textContent()).toMatch(/requires → C[0-9] Secure cookie attribute/);

      await list.getByRole("button", { name: /^C[0-9] Secure cookie attribute$/ }).focus();
      await page.keyboard.press("Enter");
      await page.getByRole("dialog", { name: "Secure cookie attribute" }).waitFor();
    } finally {
      await close();
    }
  });
});

describe("pictogram fallback (TST-023, AC-025)", () => {
  it("draws the layer pictogram for an unknown id, keeps the concept and lists the file in problems", async () => {
    const { page, close } = await open(unknownPictogram, "light");
    try {
      const unknown = page.locator(`[data-testid="concept"][data-id="${tst032Concepts[0]!.id}"]`);
      const plain = page.locator(`[data-testid="concept"][data-id="${tst032Concepts[1]!.id}"]`);
      expect(await unknown.getAttribute("data-pictogram")).toBe("client");
      expect(await plain.getAttribute("data-pictogram")).toBe("client");
      const problems = page.getByTestId("problems");
      await problems.waitFor();
      expect(await problems.textContent()).toContain(`${tst032Concepts[0]!.id}.md`);
      expect(await problems.textContent()).toContain("no-such-picture");
    } finally {
      await close();
    }
  });
});
