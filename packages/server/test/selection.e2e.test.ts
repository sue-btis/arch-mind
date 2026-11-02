import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type BrowserContextOptions, type Locator, type Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { tst032Concepts } from "@arch-mind/rules/fixtures";
import { addDays, localDate, setupStore, writeConceptAtomic, type Concept } from "@arch-mind/rules";
import { startServer, type RunningServer } from "../src/app.ts";

const uiDir = fileURLToPath(new URL("../../ui/dist", import.meta.url));
const shotDir = process.env.ARCH_MIND_SCREENSHOT_DIR;
const VIEWPORT = { width: 1366, height: 768 };
const today = localDate();

const FOCUS = "secure-context";
const byId = (id: string) => tst032Concepts.find((c) => c.id === id)!;
const outgoing = byId(FOCUS).relations.map((r) => r.to);
// Its neighbours all sit on the client plate, so the whole neighbourhood fits the free area at Fit.
const COMPACT = "secure-attr";
const compactHood = [COMPACT, ...tst032Concepts.filter((c) => c.id === COMPACT || c.relations.some((r) => r.to === COMPACT)).map((c) => c.id), ...byId(COMPACT).relations.map((r) => r.to)];
const incoming = tst032Concepts.filter((c) => c.relations.some((r) => r.to === FOCUS)).map((c) => c.id);
const neighbours = [...new Set([...outgoing, ...incoming])];
const strangers = tst032Concepts.map((c) => c.id).filter((id) => id !== FOCUS && !neighbours.includes(id));

const dueConcepts: Concept[] = tst032Concepts
  .map((c) => ({ ...c, recall: c.recall.map((q) => ({ ...q, confirmed: addDays(today, -1) })) }))
  .sort((a, b) => (a.id < b.id ? -1 : 1));

let dir: string;
let running: RunningServer;
let browser: Browser;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "arch-mind-selection-"));
  const store = await setupStore(join(dir, "store"), join(dir, "config.json"));
  for (const concept of tst032Concepts) await writeConceptAtomic(store, concept);
  running = await startServer({ storePath: store, uiDir, port: 0 });

  browser = await chromium.launch({ channel: "chrome" });
});

afterAll(async () => {
  await browser?.close();
  await running?.close();
  for (const server of reviewers) await server.close();
  await rm(dir, { recursive: true, force: true });
});

const reviewers: RunningServer[] = [];
// Grading appends to the store, so every review test gets its own.
async function reviewServer(name: string) {
  const store = await setupStore(join(dir, name), join(dir, `${name}.json`));
  for (const concept of dueConcepts) await writeConceptAtomic(store, concept);
  const server = await startServer({ storePath: store, uiDir, port: 0 });
  reviewers.push(server);
  return server;
}

async function openPage(server: RunningServer, scheme: "light" | "dark" = "light", options: BrowserContextOptions = {}) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, colorScheme: scheme, ...options });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${server.port}/`);
  await page.getByTestId("board").waitFor();
  return { page, close: () => context.close() };
}

async function openPlates(server: RunningServer, scheme: "light" | "dark" = "light", options: BrowserContextOptions = {}) {
  const opened = await openPage(server, scheme, options);
  await opened.page.getByTestId("concept").first().waitFor();
  await opened.page.waitForFunction(() => document.querySelectorAll('[data-testid="wire"]').length > 0);
  return opened;
}

async function shot(page: Page, name: string) {
  if (!shotDir) return;
  await mkdir(shotDir, { recursive: true });
  await page.screenshot({ path: join(shotDir, name), animations: "disabled" });
}

const concept = (page: Page, id: string) => page.locator(`[data-testid="concept"][data-id="${id}"]`);
const drawer = (page: Page) => page.getByTestId("concept-detail");
const opacityOf = (target: Locator) => target.evaluate((el) => Number.parseFloat(getComputedStyle(el).opacity));
const viewBox = (page: Page) =>
  page.getByTestId("plates").evaluate((svg) => {
    const v = (svg as SVGSVGElement).viewBox.baseVal;
    return { x: v.x, y: v.y, width: v.width };
  });
const worldTransform = (page: Page) => page.getByTestId("plates").evaluate((svg) => svg.querySelector(":scope > g")?.getAttribute("transform") ?? null);

// A point on the plates' own canvas: no concept, wire, plate label, island or drawer on top of it.
const emptyPoint = (page: Page) =>
  page.getByTestId("plates").evaluate((svg) => {
    for (let y = 100; y < 700; y += 20) {
      for (let x = 240; x < 900; x += 20) if (document.elementFromPoint(x, y) === svg) return { x, y };
    }
    throw new Error("no empty canvas point");
  });

async function expectInFreeArea(page: Page, ids: string[]) {
  const drawerBox = (await drawer(page).boundingBox())!;
  const filters = (await page.locator("aside").boundingBox())!;
  const legend = (await page.locator("section[aria-labelledby=wires-title]").boundingBox())!;
  const zoom = (await page.getByRole("group", { name: "Zoom" }).boundingBox())!;
  for (const id of ids) {
    const box = (await concept(page, id).boundingBox())!;
    expect(box.x + box.width, id).toBeLessThanOrEqual(drawerBox.x);
    expect(box.x, id).toBeGreaterThanOrEqual(filters.x + filters.width);
    expect(box.y, id).toBeGreaterThanOrEqual(64);
    expect(box.y + box.height, id).toBeLessThanOrEqual(Math.min(legend.y, zoom.y));
  }
}

async function select(page: Page, id: string) {
  await concept(page, id).click();
  await drawer(page).waitFor();
  await drawer(page).getByText(/Box \d · due/).first().waitFor();
}

describe("selection and the relation drawer (TST-027, AC-029, AC-030, AC-030a, AC-031, AC-032)", () => {
  it("lifts the selection, keeps its neighbourhood and lets the rest recede", async () => {
    const { page, close } = await openPlates(running);
    try {
      await select(page, FOCUS);
      await page.waitForTimeout(500);
      for (const id of [FOCUS, ...neighbours]) expect(await opacityOf(concept(page, id)), id).toBe(1);
      for (const id of strangers) expect(await opacityOf(concept(page, id)), id).toBeLessThanOrEqual(0.2);

      const wires = await page.getByTestId("wire").evaluateAll((all) =>
        all.map((w) => ({ label: w.getAttribute("aria-label")!, opacity: Number.parseFloat(getComputedStyle(w).opacity) })),
      );
      const title = (id: string) => byId(id).title;
      const mine = (label: string) => [FOCUS, ...neighbours].some((id) => label.includes(title(id))) && label.includes(title(FOCUS));
      expect(wires.filter((w) => w.opacity === 1).length).toBe(outgoing.length + incoming.length);
      for (const w of wires) expect(w.opacity === 1, w.label).toBe(mine(w.label));
      const chips = await page.locator(".chips > g").evaluateAll((all) => all.map((c) => Number.parseFloat(getComputedStyle(c).opacity)));
      expect(chips.filter((o) => o === 1).length).toBe(outgoing.length + incoming.length);
      expect(Math.max(...chips.filter((o) => o !== 1))).toBeLessThanOrEqual(0.2);
      const plates = await page.locator("[data-plate]").evaluateAll((all) => all.map((p) => Number.parseFloat(getComputedStyle(p).opacity)));
      expect(Math.min(...plates)).toBeLessThanOrEqual(0.2);

      const lifted = await concept(page, FOCUS).evaluate((el) => ({
        lift: getComputedStyle(el.querySelector(".lift")!).transform,
        halo: Number.parseFloat(getComputedStyle(el.querySelector(".halo")!).opacity),
        weight: getComputedStyle(el.querySelector(".nlab")!).fontWeight,
      }));
      expect(lifted.lift).not.toBe("none");
      expect(lifted.halo).toBeGreaterThan(0);
      expect(lifted.weight).toBe("600");
      const resting = await concept(page, strangers[0]!).evaluate((el) => getComputedStyle(el.querySelector(".lift")!).transform);
      expect(resting).toBe("none");

      const far = concept(page, strangers[0]!);
      expect(await far.getAttribute("tabindex")).toBe("0");
      expect(await far.getAttribute("aria-label")).toContain(byId(strangers[0]!).title);
    } finally {
      await close();
    }
  });

  it.each(["light", "dark"] as const)("shows the drawer contents beside the framed neighbourhood, %s mode", async (scheme) => {
    const { page, close } = await openPlates(running, scheme);
    try {
      await select(page, FOCUS);
      const dialog = page.getByRole("dialog", { name: byId(FOCUS).title });
      const text = (await dialog.textContent()) ?? "";
      const focus = byId(FOCUS);
      for (const part of Object.values(focus.seeI)) expect(text).toContain(part);
      for (const id of [...outgoing, ...incoming]) expect(text).toContain(byId(id).title);
      for (const r of focus.relations) {
        expect(text).toContain(r.source);
        expect(text).toContain(r.explanation);
      }
      for (const id of incoming) for (const r of byId(id).relations.filter((x) => x.to === FOCUS)) expect(text).toContain(r.explanation);
      expect(text).toContain(focus.recall[0]!.question);
      expect(text).toContain("web");
      expect(text).toContain("security");
      expect(await dialog.getByTestId("relation-row").count()).toBe(outgoing.length + incoming.length);

      const header = await dialog.evaluate((el) => {
        const pic = el.querySelector("svg.pic")!.getBoundingClientRect();
        return { pic: [pic.width, pic.height], pill: el.querySelector('[data-testid="layer-pill"]')!.textContent, layer: el.getAttribute("data-layer") };
      });
      expect(header.pic).toEqual([64, 64]);
      expect(header.pill).toMatch(/^[A-Z]\d+ · client$/);
      expect(header.layer).toBe("client");
      const close = dialog.getByRole("button", { name: "Close" });
      expect(await close.evaluate((el) => getComputedStyle(el).borderRadius)).toBe("50%");

      await page.waitForTimeout(700);
      await expectInFreeArea(page, [FOCUS]);
      await page.mouse.move(700, 4);
      await page.waitForTimeout(200);
      await shot(page, `selection-drawer-1366x768-${scheme}.png`);
    } finally {
      await close();
    }
  });

  it("frames a selection and its neighbours inside the area the drawer and islands leave free", async () => {
    const { page, close } = await openPlates(running);
    try {
      await select(page, COMPACT);
      await page.waitForTimeout(700);
      await expectInFreeArea(page, compactHood);
    } finally {
      await close();
    }
  });

  it("moves the counts island out from behind the open drawer", async () => {
    const { page, close } = await openPlates(running);
    try {
      await select(page, COMPACT);
      await page.waitForTimeout(700);
      const counts = (await page.getByText(/ of \d+ concepts shown$/).boundingBox())!;
      const drawer = (await page.getByTestId("concept-detail").boundingBox())!;
      expect(counts.x + counts.width).toBeLessThanOrEqual(drawer.x);
    } finally {
      await close();
    }
  });

  it("draws the neighbourhood wires on from source to target within 600 ms", async () => {
    const { page, close } = await openPlates(running);
    try {
      await concept(page, FOCUS).click();
      const animations = await page.locator('.wire[data-state="near"] .line').evaluateAll((lines) =>
        lines.map((line) => line.getAnimations().map((a) => ({ name: (a as CSSAnimation).animationName, ms: Number(a.effect!.getComputedTiming().duration) }))),
      );
      expect(animations).toHaveLength(outgoing.length + incoming.length);
      for (const list of animations) {
        expect(list.some((a) => a.name.startsWith("draw") && a.ms <= 600)).toBe(true);
      }
    } finally {
      await close();
    }
  });

  it("selects the other end of a relation row, moves focus to the drawer and glides the camera", async () => {
    const { page, close } = await openPlates(running);
    try {
      await select(page, FOCUS);
      await page.waitForTimeout(700);
      const before = await viewBox(page);
      const target = outgoing[0]!;
      const row = drawer(page).locator(`[data-testid="relation-row"][data-other="${target}"] button`);
      await row.click();
      await page.getByRole("dialog", { name: byId(target).title }).waitFor();
      expect(await page.evaluate(() => document.activeElement?.getAttribute("data-testid"))).toBe("concept-detail");
      expect(await opacityOf(concept(page, target))).toBe(1);
      expect(await concept(page, target).getAttribute("data-state")).toBe("selected");
      await page.waitForFunction(() => document.querySelector('[data-testid="concept-detail"]')!.textContent!.includes("Box"));
      expect(await worldTransform(page)).not.toBeNull();
      await page.waitForTimeout(700);
      expect(await worldTransform(page)).toBeNull();
      const after = await viewBox(page);
      expect(after.x !== before.x || after.width !== before.width).toBe(true);
    } finally {
      await close();
    }
  });

  it("clears with Escape, the close control or a click on empty canvas, returning prominence, camera and focus", async () => {
    const { page, close } = await openPlates(running);
    try {
      const start = await viewBox(page);
      for (const how of ["escape", "button", "canvas"] as const) {
        const opener = concept(page, FOCUS);
        await opener.click();
        await drawer(page).waitFor();
        await page.waitForTimeout(500);
        const framed = await viewBox(page);
        expect(framed.x !== start.x || framed.width !== start.width).toBe(true);

        if (how === "escape") await page.keyboard.press("Escape");
        else if (how === "button") await drawer(page).getByRole("button", { name: "Close" }).click();
        else {
          const empty = await emptyPoint(page);
          await page.mouse.click(empty.x, empty.y);
        }
        await drawer(page).waitFor({ state: "detached" });
        await page.waitForTimeout(600);

        const back = await viewBox(page);
        expect(back.x).toBeCloseTo(start.x, 1);
        expect(back.width).toBeCloseTo(start.width, 1);
        for (const id of tst032Concepts.map((c) => c.id)) expect(await opacityOf(concept(page, id)), `${how} ${id}`).toBe(1);
        expect(await page.locator('[data-state="far"]').count()).toBe(0);
        expect(await page.evaluate(() => document.activeElement?.getAttribute("data-id"))).toBe(FOCUS);
      }
    } finally {
      await close();
    }
  });

  it("keeps the selected row and column of the matrix prominent and recedes the other cells", async () => {
    const { page, close } = await openPage(running);
    try {
      await page.getByRole("button", { name: "Matrix" }).click();
      const header = page.locator("tbody th button", { hasText: byId(FOCUS).title });
      await header.click();
      await drawer(page).waitFor();
      await page.waitForTimeout(500);
      const cells = await page.locator("tbody tr").evaluateAll((rows, id) => {
        const focusRow = rows.findIndex((r) => r.querySelector("th button")?.textContent?.includes(id));
        return rows.flatMap((row, r) =>
          [...row.querySelectorAll("td")].map((td, c) => ({ near: r === focusRow || c === focusRow, opacity: Number.parseFloat(getComputedStyle(td).opacity) })),
        );
      }, byId(FOCUS).title);
      for (const cell of cells) expect(cell.near ? cell.opacity === 1 : cell.opacity <= 0.2).toBe(true);
      await shot(page, "matrix-selection-1366x768-light.png");
      await page.keyboard.press("Escape");
      await drawer(page).waitFor({ state: "detached" });
      expect(await page.locator('td[data-state="far"]').count()).toBe(0);
    } finally {
      await close();
    }
  });
});

describe("keyboard path and accessible list (TST-028, AC-033)", () => {
  it("opens a concept from the keyboard, follows a relation row, and Escape returns focus to the opener", async () => {
    const { page, close } = await openPlates(running);
    try {
      const opener = concept(page, FOCUS);
      await opener.focus();
      await page.keyboard.press("Enter");
      await drawer(page).waitFor();
      expect(await page.evaluate(() => document.activeElement?.getAttribute("data-testid"))).toBe("concept-detail");

      const target = outgoing[0]!;
      const row = drawer(page).locator(`[data-testid="relation-row"][data-other="${target}"] button`);
      for (let i = 0; i < 40 && !(await row.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press("Tab");
      expect(await row.evaluate((el) => el === document.activeElement)).toBe(true);
      const ring = await row.evaluate((el) => {
        const style = getComputedStyle(el);
        return { style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth) };
      });
      expect(ring).toEqual({ style: "solid", width: 2 });
      await page.keyboard.press("Enter");
      await page.getByRole("dialog", { name: byId(target).title }).waitFor();
      expect(await concept(page, target).getAttribute("data-state")).toBe("selected");

      await page.keyboard.press("Escape");
      await drawer(page).waitFor({ state: "detached" });
      expect(await page.evaluate(() => document.activeElement?.getAttribute("data-id"))).toBe(FOCUS);
    } finally {
      await close();
    }
  });

  it("reaches receded concepts and wires with Tab", async () => {
    const { page, close } = await openPlates(running);
    try {
      await select(page, FOCUS);
      await page.keyboard.press("Escape");
      await drawer(page).waitFor({ state: "detached" });
      await select(page, FOCUS);
      const far = concept(page, strangers[0]!);
      await far.focus();
      expect(await far.evaluate((el) => el === document.activeElement || el.contains(document.activeElement))).toBe(true);
      const wire = page.locator('.wire[data-state="far"]').first();
      await wire.focus();
      expect(await wire.evaluate((el) => el === document.activeElement)).toBe(true);
    } finally {
      await close();
    }
  });

  it("lists each relation under its concept and selects its other end from the list", async () => {
    const { page, close } = await openPlates(running);
    try {
      const list = page.getByTestId("concept-list");
      await list.locator("summary").focus();
      await page.keyboard.press("Enter");
      const target = byId(outgoing[0]!);
      const owner = list.locator("li", { has: page.getByRole("button", { name: new RegExp(`^[A-Z]\\d+ ${FOCUS_TITLE}$`) }) }).first();
      const relation = owner.getByRole("button", { name: new RegExp(`^[A-Z]\\d+ ${target.title}, `) });
      await relation.focus();
      await page.keyboard.press("Enter");
      await page.getByRole("dialog", { name: target.title }).waitFor();
      expect(await concept(page, target.id).getAttribute("data-state")).toBe("selected");
    } finally {
      await close();
    }
  });
});

const FOCUS_TITLE = byId(FOCUS).title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

describe("camera feel (AC-034)", () => {
  it("never zooms out below Fit and shows the current percent", async () => {
    const { page, close } = await openPlates(running);
    try {
      const fit = await viewBox(page);
      const percent = await page.getByTestId("zoom-value").textContent();
      await page.mouse.move(700, 300);
      await page.keyboard.down("Control");
      await page.mouse.wheel(0, 400);
      await page.keyboard.up("Control");
      expect((await viewBox(page)).width).toBeCloseTo(fit.width, 3);
      expect(await page.getByTestId("zoom-value").textContent()).toBe(percent);

      await page.keyboard.down("Control");
      await page.mouse.wheel(0, -2000);
      await page.keyboard.up("Control");
      expect((await viewBox(page)).width).toBeCloseTo(fit.width / 3, 1);
      expect(Number.parseInt((await page.getByTestId("zoom-value").textContent())!, 10)).toBeCloseTo(Number.parseInt(percent!, 10) * 3, -1);
    } finally {
      await close();
    }
  });

  it("glides to a zoom step and settles within 600 ms", async () => {
    const { page, close } = await openPlates(running);
    try {
      await page.getByRole("button", { name: "Zoom in" }).click();
      expect(await worldTransform(page)).not.toBeNull();
      await page.waitForTimeout(700);
      expect(await worldTransform(page)).toBeNull();
    } finally {
      await close();
    }
  });

  it("keeps sliding after a drag is released", async () => {
    const { page, close } = await openPlates(running);
    try {
      await page.getByRole("button", { name: "Zoom in" }).click();
      await page.waitForTimeout(600);
      const first = concept(page, FOCUS);
      const empty = await emptyPoint(page);
      await page.mouse.move(empty.x, empty.y);
      await page.mouse.down();
      for (let i = 1; i <= 6; i++) {
        await page.mouse.move(empty.x - i * 12, empty.y);
        await page.waitForTimeout(12);
      }
      await page.mouse.up();
      const released = (await first.boundingBox())!.x;
      await page.waitForTimeout(500);
      expect((await first.boundingBox())!.x).toBeLessThan(released - 5);
    } finally {
      await close();
    }
  });
});

describe("filter chips (AC-035)", () => {
  it("shows an All chip that is pressed until a value is chosen, and clears its group", async () => {
    const { page, close } = await openPlates(running);
    try {
      const layers = page.getByRole("group", { name: "Layers" });
      const all = layers.getByRole("button", { name: "All" });
      expect(await all.getAttribute("aria-pressed")).toBe("true");
      const client = page.getByRole("checkbox", { name: "client", exact: true });
      expect(await client.getAttribute("aria-checked")).toBe("false");
      await client.click();
      expect(await client.getAttribute("aria-checked")).toBe("true");
      expect(await all.getAttribute("aria-pressed")).toBe("false");
      await page.getByRole("checkbox", { name: "network", exact: true }).click();
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="concept"]').length === 11);
      await all.click();
      expect(await all.getAttribute("aria-pressed")).toBe("true");
      expect(await client.getAttribute("aria-checked")).toBe("false");
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="concept"]').length === 13);
      for (const legend of ["Layers", "Domains", "Concerns"]) expect(await page.locator("aside fieldset > legend", { hasText: legend }).count()).toBe(1);
      await page.getByRole("group", { name: "Domains" }).getByRole("checkbox", { name: "web", exact: true }).click();
      await shot(page, "filter-chips-1366x768-light.png");
    } finally {
      await close();
    }
  });
});

describe("chrome feel (AC-036)", () => {
  it("slides the view-switch thumb, keeps aria-pressed, and uses a blurred material for the islands", async () => {
    const { page, close } = await openPlates(running);
    try {
      const thumb = page.locator(".thumb");
      const before = (await thumb.boundingBox())!.x;
      await page.getByRole("button", { name: "Matrix" }).click();
      expect(await page.getByRole("button", { name: "Matrix" }).getAttribute("aria-pressed")).toBe("true");
      await page.waitForTimeout(500);
      const after = (await thumb.boundingBox())!;
      const matrix = (await page.getByRole("button", { name: "Matrix" }).boundingBox())!;
      expect(after.x).toBeGreaterThan(before);
      expect(after.x).toBeCloseTo(matrix.x, 0);
      expect(await page.locator("aside").evaluate((el) => getComputedStyle(el).backdropFilter)).toContain("blur");
    } finally {
      await close();
    }
  });

  it("steps the filters, legend and zoom islands away in Review and returns them", async () => {
    const { page, close } = await openPlates(running);
    try {
      await page.getByRole("button", { name: "Review", exact: true }).click();
      await page.waitForTimeout(600);
      for (const selector of ["aside", "section[aria-labelledby=wires-title]", '[role="group"][aria-label="Zoom"]']) {
        expect(await page.locator(selector).evaluate((el) => getComputedStyle(el).visibility), selector).toBe("hidden");
      }
      await page.getByRole("button", { name: "Layers", exact: true }).click();
      await page.waitForTimeout(600);
      for (const selector of ["aside", "section[aria-labelledby=wires-title]", '[role="group"][aria-label="Zoom"]']) {
        expect(await page.locator(selector).evaluate((el) => getComputedStyle(el).visibility), selector).toBe("visible");
      }
    } finally {
      await close();
    }
  });
});

describe.each(["light", "dark"] as const)("focused review at 1366 x 768, %s mode (AC-037)", (scheme) => {
  it("reveals with Space or Enter, grades with 1 and 2, shows the keys and a progress bar", async () => {
    const { page, close } = await openPage(await reviewServer(`review-${scheme}`), scheme);
    try {
      await page.getByRole("button", { name: "Review", exact: true }).click();
      await page.getByTestId("review-question").waitFor();
      const progress = page.getByRole("progressbar");
      expect(await progress.getAttribute("aria-valuemax")).toBe(String(dueConcepts.length));
      expect(await progress.getAttribute("aria-valuenow")).toBe("0");
      expect(await page.getByTestId("review-answer").count()).toBe(0);
      expect(await page.getByRole("button", { name: "Show answer" }).evaluate((el) => getComputedStyle(el, "::after").content)).toBe('"Space"');
      await page.waitForTimeout(600);
      await shot(page, `review-before-reveal-1366x768-${scheme}.png`);

      await page.keyboard.press("Space");
      await page.getByTestId("review-answer").waitFor();
      expect(await page.evaluate(() => document.activeElement?.textContent)).toBe("Right");
      expect(await page.getByRole("button", { name: "Wrong" }).evaluate((el) => getComputedStyle(el, "::after").content)).toBe('"1"');
      expect(await page.getByRole("button", { name: "Right" }).evaluate((el) => getComputedStyle(el, "::after").content)).toBe('"2"');
      await page.waitForTimeout(700);
      await shot(page, `review-after-reveal-1366x768-${scheme}.png`);

      await page.keyboard.press("1");
      await page.getByTestId("review-result").getByText(/Marked wrong\./).waitFor();
      expect(await progress.getAttribute("aria-valuenow")).toBe("1");
      await page.getByRole("button", { name: "Next" }).click();
      await page.getByRole("heading", { name: dueConcepts[1]!.recall[0]!.question }).waitFor();

      await page.keyboard.press("Enter");
      await page.getByTestId("review-answer").waitFor();
      await page.keyboard.press("2");
      await page.getByTestId("review-result").getByText(/Marked right\./).waitFor();
    } finally {
      await close();
    }
  });
});

describe("reduced motion (AC-038)", () => {
  it("moves the camera at once, draws no wires on, and still completes the selection and review flows", async () => {
    const { page, close } = await openPlates(running, "light", { reducedMotion: "reduce" });
    try {
      await page.getByRole("button", { name: "Zoom in" }).click();
      expect(await worldTransform(page)).toBeNull();
      await page.getByRole("button", { name: "Fit", exact: true }).click();

      await concept(page, FOCUS).click();
      await drawer(page).waitFor();
      expect(await worldTransform(page)).toBeNull();
      const drawing = await page.locator('.wire[data-state="near"] .line').evaluateAll((lines) => lines.flatMap((l) => l.getAnimations().map((a) => (a as CSSAnimation).animationName)));
      expect(drawing.filter((name) => name.startsWith("draw"))).toEqual([]);
      expect(await concept(page, FOCUS).evaluate((el) => getComputedStyle(el.querySelector(".lift")!).transform)).toBe("none");
      await page.getByRole("button", { name: "Matrix" }).click();
      expect(await page.locator(".thumb").evaluate((el) => getComputedStyle(el).transitionDuration)).toBe("0s");
      await page.keyboard.press("Escape");
      await drawer(page).waitFor({ state: "detached" });
    } finally {
      await close();
    }

    const review = await openPage(await reviewServer("review-reduced"), "light", { reducedMotion: "reduce" });
    try {
      await review.page.getByRole("button", { name: "Review", exact: true }).click();
      await review.page.getByTestId("review-question").waitFor();
      await review.page.keyboard.press("Space");
      await review.page.getByTestId("review-answer").waitFor();
      await review.page.keyboard.press("2");
      await review.page.getByTestId("review-result").getByText(/Marked right\./).waitFor();
      await review.page.getByRole("button", { name: "Next" }).click();
      await review.page.getByRole("heading", { name: dueConcepts[1]!.recall[0]!.question }).waitFor();
    } finally {
      await review.close();
    }
  });
});

const layerSamples = [...new Set(tst032Concepts.map((c) => c.layer))].map((layer) => [layer, tst032Concepts.find((c) => c.layer === layer)!.id] as const);

describe.each(["light", "dark"] as const)("text contrast over the translucent material, %s mode (AC-033)", (scheme) => {
  it.each(layerSamples)("keeps drawer, chip and review text at WCAG 2.2 AA for a %s concept (%s)", async (_layer, id) => {
    const { page, close } = await openPlates(running, scheme);
    try {
      // Focus reveals the concept, so layers that sit below the legend at Fit can be chosen too.
      await concept(page, id).focus();
      await page.keyboard.press("Enter");
      await drawer(page).waitFor();
      await page.waitForTimeout(600);
      const dialogSelectors: [string, string][] = [
        ["title", "h2"],
        ["pill", '[data-testid="layer-pill"]'],
        ["section title", "h3"],
        ["relation row", '[data-testid="relation-row"] button span'],
        ["citation", '[data-testid="relation-row"] p'],
        ["facet", 'ul[aria-label="Facets"] li'],
      ];
      const samples = await page.evaluate((selectors) => {
        const canvas = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
        const rgba = (css: string) => {
          canvas.clearRect(0, 0, 1, 1);
          canvas.fillStyle = "#000";
          canvas.fillStyle = css;
          canvas.fillRect(0, 0, 1, 1);
          const [r, g, b, a] = canvas.getImageData(0, 0, 1, 1).data;
          return { rgb: [r!, g!, b!], alpha: a! / 255 };
        };
        const dialog = document.querySelector('[data-testid="concept-detail"]')!;
        const els: [string, Element | null][] = [
          ...selectors.map(([name, selector]) => [name, dialog.querySelector(selector)] as [string, Element | null]),
          ["chip", document.querySelector('[role="checkbox"][aria-checked="false"]')],
          ["all chip pressed", document.querySelector('button[aria-pressed="true"].rounded-full')],
        ];
        return els.map(([name, el]) => {
          const walker = el && document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          let text: Text | null = null;
          for (let node = walker?.nextNode(); node && !text; node = walker!.nextNode()) {
            if (node.textContent?.trim() && !node.parentElement!.closest(".sr-only")) text = node as Text;
          }
          const range = document.createRange();
          if (text) range.selectNodeContents(text);
          const box = text ? range.getBoundingClientRect() : null;
          return { name, color: el ? rgba(getComputedStyle(el).color) : null, box: box ? { x: box.x, y: box.y, width: box.width, height: box.height } : null };
        });
      }, dialogSelectors);

      // Text is hidden so the screenshot holds only what the text sits on: gradients, tints and the blurred backdrop included.
      await page.addStyleTag({ content: "* { color: transparent !important; text-shadow: none !important; caret-color: transparent !important; }" });
      const png = (await page.screenshot()).toString("base64");
      const ratios = await page.evaluate(
        async ({ png, samples }) => {
          const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${png}`)).blob());
          const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
          const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
          ctx.drawImage(bitmap, 0, 0);
          const lum = (c: number[]) => {
            const [r, g, b] = c.map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
            return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
          };
          return samples.map(({ name, color, box }) => {
            if (!color || !box) return [name, 0] as const;
            const { data } = ctx.getImageData(Math.ceil(box.x), Math.floor(box.y + box.height / 2 - 2), Math.max(1, Math.floor(box.width)), 4);
            let worst = Infinity;
            for (let i = 0; i < data.length; i += 4) {
              const bg = [data[i]!, data[i + 1]!, data[i + 2]!];
              const fg = color.rgb.map((v, k) => v * color.alpha + bg[k]! * (1 - color.alpha));
              const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a);
              worst = Math.min(worst, (hi! + 0.05) / (lo! + 0.05));
            }
            return [name, worst, JSON.stringify(color), JSON.stringify(box)] as const;
          });
        },
        { png, samples },
      );
      expect(ratios.filter(([, value]) => value < 4.5).map(([name, value, c, b]) => `${name} ${value.toFixed(2)} ${c} ${b}`)).toEqual([]);
    } finally {
      await close();
    }
  });

  it("marks a pressed layer chip with a different color and background", async () => {
    const { page, close } = await openPlates(running, scheme);
    try {
      await page.getByRole("checkbox", { name: "client", exact: true }).click();
      const checked = await page.getByRole("checkbox", { name: "client", exact: true }).evaluate((el) => {
        const s = getComputedStyle(el);
        return [s.color, s.backgroundColor];
      });
      expect(checked[0]).not.toBe(checked[1]);
    } finally {
      await close();
    }
  });
});
