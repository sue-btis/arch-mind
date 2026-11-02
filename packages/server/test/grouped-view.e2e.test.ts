import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Locator, type Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { groupedConcepts } from "@arch-mind/rules/fixtures";
import { setupStore, writeConceptAtomic } from "@arch-mind/rules";
import { startServer, type RunningServer } from "../src/app.ts";
import { contrastFailures, type Sample } from "./contrast.ts";

const uiDir = fileURLToPath(new URL("../../ui/dist", import.meta.url));
const shotDir = process.env.ARCH_MIND_SCREENSHOT_DIR;
const VIEWPORT = { width: 1366, height: 768 };
// The board is 612 px wide here, so even the grouped view with every group closed (1107 px) shrinks below the floor.
const NARROW_VIEWPORT = { width: 860, height: 768 };

const SMALL = "group:server:models";
const OTHER_SMALL = "group:client:mobile";
const BIG = "group:server:web";
const GROUPS = 7;

let dir: string;
let server: RunningServer;
let browser: Browser;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "arch-mind-grouped-"));
  const store = await setupStore(join(dir, "store"), join(dir, "config.json"));
  for (const concept of groupedConcepts) await writeConceptAtomic(store, concept);
  server = await startServer({ storePath: store, uiDir, port: 0 });
  browser = await chromium.launch({ channel: "chrome" });
});

afterAll(async () => {
  await browser?.close();
  await server?.close();
  await rm(dir, { recursive: true, force: true });
});

async function openPage(options: { scheme?: "light" | "dark"; view?: "Layers" | "Matrix"; viewport?: { width: number; height: number } } = {}) {
  const { scheme = "light", view = "Layers", viewport = VIEWPORT } = options;
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme: scheme });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  await page.goto(`http://127.0.0.1:${server.port}/`);
  await page.getByTestId("board").waitFor();
  if (view === "Matrix") await page.getByRole("button", { name: "Matrix" }).click();
  return { page, close: () => context.close() };
}

async function shot(page: Page, name: string) {
  if (!shotDir) return;
  await page.waitForTimeout(700);
  await mkdir(shotDir, { recursive: true });
  await page.screenshot({ path: join(shotDir, name), animations: "disabled" });
}

const group = (page: Page, id: string) => page.locator(`[data-testid="group"][data-id="${id}"]`);
const groups = (page: Page) => page.getByTestId("group");
const concepts = (page: Page) => page.getByTestId("concept");
const concept = (page: Page, id: string) => page.locator(`[data-testid="concept"][data-id="${id}"]`);
const message = (page: Page) => page.getByTestId("fit-message");
const groupMessage = (page: Page) => page.getByTestId("group-message");
const groupPill = (page: Page) => page.getByTestId("group-pill");
const focusPill = (page: Page) => page.getByTestId("focus-pill");
const drawer = (page: Page) => page.getByTestId("concept-detail");
const finder = (page: Page) => page.getByRole("dialog", { name: "Find a concept" });
const closeButton = (page: Page) => page.getByTestId("group-close");
const popover = (page: Page) => page.getByTestId("relation-popover");
const announcement = (page: Page) => page.locator('p.sr-only[role="status"]');
const legend = (page: Page) => page.locator("section[aria-labelledby=wires-title]");
const pressedTypes = (page: Page) => legend(page).locator("button[aria-pressed=true]").count();
const drawnIds = (page: Page) => concepts(page).evaluateAll((all) => all.map((c) => c.getAttribute("data-id")!).sort());

// The plates fit by width only, so a tall scene needs panning: focusing an element brings it into view like a Tab does.
async function press(target: Locator) {
  await target.focus();
  await target.click();
}

async function openGrouped(page: Page) {
  await message(page).waitFor();
  await message(page).getByRole("button", { name: "Group by domain" }).click();
  await groupPill(page).waitFor();
}

async function openGroupedFits(page: Page) {
  await openGrouped(page);
  await expect.poll(() => groups(page).count()).toBe(GROUPS);
}

describe("grouped layer view (TST-045)", () => {
  it("offers 'Group by domain' last on the refused layer view and takes no way out on its own", async () => {
    const { page, close } = await openPage();
    try {
      await message(page).waitFor();
      expect(await message(page).getByRole("button").allTextContents()).toEqual(["Narrow the filters", "Focus on a concept", "Group by domain"]);
      await page.waitForTimeout(300);
      expect(await groupPill(page).count()).toBe(0);
      await shot(page, "m10-fit-message-three-buttons-light.png");
    } finally {
      await close();
    }
  });

  it("draws a connection of two contains relations in the contains color and marker", async () => {
    const extra = { ...groupedConcepts[0]!, id: "g-extra", title: "Extra", layer: "data" as const, domains: ["extra"], relations: [] };
    const intoExtra = (c: (typeof groupedConcepts)[number]) => ({ ...c, relations: [...c.relations, { type: "contains", to: "g-extra", source: "Fixture", explanation: "into extra" }] });
    const store = await setupStore(join(dir, "store-contains"), join(dir, "config-contains.json"));
    const all = [...groupedConcepts.map((c) => (c.id === "g-ledger" || c.id === "g-audit" ? intoExtra(c) : c)), extra];
    for (const c of all) await writeConceptAtomic(store, c);
    const second = await startServer({ storePath: store, uiDir, port: 0 });
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(8000);
      await page.goto(`http://127.0.0.1:${second.port}/`);
      await openGrouped(page);
      const wire = page.locator('[data-testid="wire"][aria-label^="2 contains:"]');
      await wire.first().waitFor({ state: "attached" });
      expect(await wire.count()).toBe(1);
      const line = wire.locator("path.line");
      expect(await line.getAttribute("marker-end")).toBe("url(#m-contains)");
      expect(await line.evaluate((el) => (el as SVGElement).style.stroke)).toBe("var(--wire-contains)");
    } finally {
      await context.close();
      await second.close();
    }
  });

  it("groups by first domain with counts, closed, and announces it", async () => {
    const { page, close } = await openPage();
    try {
      await openGroupedFits(page);
      expect(await concepts(page).count()).toBe(0);
      expect(await groupPill(page).textContent()).toMatch(/Grouped by domain\s*·\s*Exit/);
      await expect.poll(() => announcement(page).textContent()).toBe("Grouped by domain");
      expect(await group(page, SMALL).getAttribute("aria-label")).toBe("models group, 2 concepts");
      expect(await group(page, BIG).getAttribute("aria-label")).toBe("web group, 13 concepts");
      expect(await group(page, "group:network:No domain").getAttribute("aria-label")).toBe("No domain group, 1 concept");
      expect(await page.getByTestId("wire").count()).toBeGreaterThan(0);
      expect(Number(await page.getByTestId("plates").getAttribute("data-fit-scale"))).toBeGreaterThanOrEqual(0.85);
      await shot(page, "m10-grouped-closed-light.png");
    } finally {
      await close();
    }
  });

  it("opens a group by click, Enter or Space, swaps it for another, and closes it with the × or Escape", async () => {
    const { page, close } = await openPage();
    try {
      await openGroupedFits(page);
      await press(group(page, SMALL));
      await expect.poll(() => drawnIds(page)).toEqual(["g-audit", "g-ledger"]);
      expect(await groups(page).count()).toBe(GROUPS - 1);
      await expect.poll(() => announcement(page).textContent()).toBe("Opened the models group");
      await shot(page, "m10-grouped-open-light.png");

      await group(page, OTHER_SMALL).focus();
      await page.keyboard.press("Enter");
      await expect.poll(() => drawnIds(page)).toEqual(["g-app", "g-cache", "g-pay"]);
      expect(await closeButton(page).count()).toBe(1);

      await closeButton(page).focus();
      await page.keyboard.press("Space");
      await expect.poll(() => concepts(page).count()).toBe(0);
      await expect.poll(() => announcement(page).textContent()).toBe("Group closed");

      await group(page, SMALL).focus();
      await page.keyboard.press("Space");
      await expect.poll(() => concepts(page).count()).toBe(2);
      await press(closeButton(page));
      await expect.poll(() => concepts(page).count()).toBe(0);
      await press(group(page, SMALL));
      await expect.poll(() => concepts(page).count()).toBe(2);
      await page.keyboard.press("Escape");
      await expect.poll(() => concepts(page).count()).toBe(0);
      expect(await groupPill(page).count()).toBe(1);
    } finally {
      await close();
    }
  });

  it("keeps a group that would not fit closed, says so, and offers focus on one of its concepts or narrower filters", async () => {
    const { page, close } = await openPage();
    try {
      await openGroupedFits(page);
      await press(group(page, BIG));
      await groupMessage(page).waitFor();
      expect(await groupMessage(page).textContent()).toMatch(/web group has 13 concepts.*85 %.*stays closed/);
      expect(await groupMessage(page).getByRole("button").allTextContents()).toEqual(["Narrow the filters", "Focus on a concept"]);
      expect(await concepts(page).count()).toBe(0);
      expect(await groups(page).count()).toBe(GROUPS);
      await shot(page, "m10-group-too-big-light.png");

      await groupMessage(page).getByRole("button", { name: "Focus on a concept" }).click();
      await finder(page).waitFor();
      expect(await finder(page).getByRole("option").count()).toBe(13);
      await page.keyboard.press("Escape");
      await finder(page).waitFor({ state: "detached" });

      await page.keyboard.press("Escape");
      await groupMessage(page).waitFor({ state: "detached" });
    } finally {
      await close();
    }
  });

  it("reports a refused group as closed in the live region, the list and the board alike", async () => {
    const { page, close } = await openPage();
    try {
      await openGroupedFits(page);
      const list = page.getByTestId("concept-list");
      await list.locator("summary").click();
      const entry = page.getByTestId("group-entry").filter({ hasText: "server layer" }).filter({ hasText: "web" });
      await press(group(page, BIG));
      await groupMessage(page).waitFor();
      await expect.poll(() => announcement(page).textContent()).toBe("The web group stays closed: it would not fit");
      expect(await entry.textContent()).not.toMatch(/open/);
      expect(await entry.getByRole("button").first().getAttribute("aria-expanded")).toBe("false");
      expect(await list.getByRole("button", { name: /Web spoke/ }).count()).toBe(0);
      expect(await concepts(page).count()).toBe(0);
    } finally {
      await close();
    }
  });

  it("refuses the grouped view with every group closed and offers only focus and narrower filters", async () => {
    const { page, close } = await openPage({ viewport: NARROW_VIEWPORT });
    try {
      await openGrouped(page);
      await expect.poll(async () => (await message(page).getByRole("button").allTextContents()).join("|")).toBe("Narrow the filters|Focus on a concept");
      expect(await message(page).textContent()).toMatch(/85 %/);
      expect(await groups(page).count()).toBe(0);
    } finally {
      await close();
    }
  });

  it("leaves grouping with the pill and when the view changes, and keeps nothing in the browser", async () => {
    const { page, close } = await openPage();
    try {
      await openGroupedFits(page);
      await groupPill(page).getByRole("button", { name: "Exit" }).click();
      await message(page).waitFor();
      expect(await groupPill(page).count()).toBe(0);
      await expect.poll(() => announcement(page).textContent()).toBe("Grouping ended");

      await openGroupedFits(page);
      await page.getByRole("button", { name: "Matrix" }).click();
      await page.getByRole("button", { name: "Layers" }).click();
      await message(page).waitFor();
      expect(await groupPill(page).count()).toBe(0);
      expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
    } finally {
      await close();
    }
  });

  it("opens the layer view grouped from the refused matrix", async () => {
    const { page, close } = await openPage({ view: "Matrix", viewport: NARROW_VIEWPORT });
    try {
      await message(page).waitFor();
      expect(await message(page).getByRole("button").allTextContents()).toEqual(["Narrow the filters", "Focus on a concept", "Group by domain"]);
      expect(await page.locator("table").count()).toBe(0);
      await message(page).getByRole("button", { name: "Group by domain" }).click();
      await groupPill(page).waitFor();
      expect(await page.getByTestId("board").getAttribute("data-view")).toBe("layers");
      await expect.poll(async () => (await message(page).getByRole("button").allTextContents()).join("|")).toBe("Narrow the filters|Focus on a concept");
    } finally {
      await close();
    }
  });

  it("opens the group of a concept chosen in the finder and selects it; offers focus when that group would not fit", async () => {
    const { page, close } = await openPage();
    try {
      await openGroupedFits(page);
      await page.keyboard.press("Control+k");
      await finder(page).waitFor();
      await page.getByRole("combobox").fill("Audit trail");
      await page.keyboard.press("Enter");
      await drawer(page).waitFor();
      await expect.poll(() => drawnIds(page)).toEqual(["g-audit", "g-ledger"]);
      await expect.poll(() => concept(page, "g-audit").getAttribute("data-state")).toBe("selected");

      await page.keyboard.press("Control+k");
      await finder(page).waitFor();
      await page.getByRole("combobox").fill("Web spoke 3");
      await page.keyboard.press("Enter");
      await groupMessage(page).waitFor();
      expect(await concepts(page).count()).toBe(0);
      await groupMessage(page).getByRole("button", { name: /^Focus on/ }).click();
      await focusPill(page).waitFor();
      await expect.poll(() => concept(page, "g-spoke-3").count()).toBe(1);
    } finally {
      await close();
    }
  });

  it("lets focus take over a grouped view and returns to it with the same group open", async () => {
    const { page, close } = await openPage();
    try {
      await openGroupedFits(page);
      await press(group(page, SMALL));
      await press(concept(page, "g-ledger"));
      await drawer(page).waitFor();
      await page.keyboard.press("f");
      await focusPill(page).waitFor();
      expect(await groupPill(page).count()).toBe(0);
      await expect.poll(() => groups(page).count()).toBe(0);
      await focusPill(page).getByRole("button", { name: "Exit" }).click();
      await groupPill(page).waitFor();
      await expect.poll(() => drawnIds(page)).toEqual(["g-audit", "g-ledger"]);
    } finally {
      await close();
    }
  });

  it("keeps a grouped connection prominent when any of its relations has the legend type", async () => {
    const { page, close } = await openPage();
    try {
      await openGroupedFits(page);
      const states = () => page.locator("[data-chip]").evaluateAll((all) => all.map((c) => c.getAttribute("data-state")));
      await legend(page).getByRole("button", { name: "contains", exact: true }).click();
      await expect.poll(async () => (await states()).filter((s) => s === "near").length).toBeGreaterThan(0);
      expect((await states()).filter((s) => s === "near").length).toBeLessThan((await states()).length);
      await legend(page).getByRole("button", { name: "contains", exact: true }).click();
      await expect.poll(async () => [...new Set(await states())]).toEqual([null]);
    } finally {
      await close();
    }
  });

  it("closes one layer per Escape: finder, pinned popover, focus, open group, drawer, legend type", async () => {
    const { page, close } = await openPage();
    try {
      await openGroupedFits(page);
      await press(group(page, SMALL));
      await press(concept(page, "g-ledger"));
      await drawer(page).waitFor();
      await legend(page).getByRole("button", { name: "contains", exact: true }).click();
      await page.keyboard.press("f");
      await focusPill(page).waitFor();
      await page.getByTestId("wire").first().focus();
      await page.keyboard.press("Enter");
      await popover(page).waitFor();
      await page.keyboard.press("Control+k");
      await finder(page).waitFor();

      await page.keyboard.press("Escape");
      await finder(page).waitFor({ state: "detached" });
      expect(await popover(page).count()).toBe(1);
      await page.keyboard.press("Escape");
      await popover(page).waitFor({ state: "detached" });
      expect(await focusPill(page).count()).toBe(1);
      await page.keyboard.press("Escape");
      await focusPill(page).waitFor({ state: "detached" });
      await closeButton(page).waitFor();
      expect(await drawer(page).count()).toBe(1);
      await page.keyboard.press("Escape");
      await closeButton(page).waitFor({ state: "detached" });
      expect(await drawer(page).count()).toBe(1);
      await page.keyboard.press("Escape");
      await drawer(page).waitFor({ state: "detached" });
      expect(await pressedTypes(page)).toBe(1);
      await page.keyboard.press("Escape");
      await expect.poll(() => pressedTypes(page)).toBe(0);
    } finally {
      await close();
    }
  });

  it("lists each group with its count and, for the open group, its concepts and relations", async () => {
    const { page, close } = await openPage();
    try {
      await openGroupedFits(page);
      const list = page.getByTestId("concept-list");
      await list.locator("summary").click();
      const entries = page.getByTestId("group-entry");
      expect(await entries.count()).toBe(GROUPS);
      const models = entries.filter({ hasText: "server layer" }).filter({ hasText: "models" });
      expect(await models.textContent()).toMatch(/2 concepts/);
      expect(await list.getByRole("button", { name: /Ledger service/ }).count()).toBe(0);
      await models.getByRole("button").first().click();
      await expect.poll(() => list.getByRole("button", { name: /Ledger service/ }).count()).toBeGreaterThan(0);
      expect(await models.textContent()).toMatch(/open/);
      await shot(page, "m10-grouped-list-light.png");
    } finally {
      await close();
    }
  });

  it("reaches groups, the × and the pill by keyboard with a visible focus ring", async () => {
    const { page, close } = await openPage();
    try {
      await openGroupedFits(page);
      await page.keyboard.press("Shift");
      await group(page, SMALL).focus();
      expect(await group(page, SMALL).locator(".focus").evaluate((el) => getComputedStyle(el).display)).toBe("inline");
      await page.keyboard.press("Enter");
      await closeButton(page).waitFor();
      await closeButton(page).focus();
      expect(await closeButton(page).locator(".focus").evaluate((el) => getComputedStyle(el).display)).toBe("inline");
      const exit = groupPill(page).getByRole("button", { name: "Exit" });
      await exit.focus();
      expect(await exit.evaluate((el) => Number.parseFloat(getComputedStyle(el).outlineWidth) >= 2)).toBe(true);
    } finally {
      await close();
    }
  });
});

// contrastFailures hides all text for its photograph, so each measurement needs a page of its own.
describe.each(["light", "dark"] as const)("grouped controls text contrast on rendered pixels, %s mode (AC-055)", (scheme) => {
  it("keeps the third fit-message button at WCAG 2.2 AA", async () => {
    const { page, close } = await openPage({ scheme });
    try {
      await message(page).waitFor();
      await page.waitForTimeout(400);
      const samples: Sample[] = [["group by domain", '[data-testid="fit-message"] button:nth-of-type(3)']];
      expect(await contrastFailures(page, samples)).toEqual([]);
    } finally {
      await close();
    }
  });

  it("keeps the pill and the × at WCAG 2.2 AA", async () => {
    const { page, close } = await openPage({ scheme });
    try {
      await openGroupedFits(page);
      await shot(page, `m10-grouped-closed-${scheme}.png`);
      await press(group(page, SMALL));
      await closeButton(page).waitFor();
      await page.mouse.move(0, 0);
      await page.waitForTimeout(700);
      await shot(page, `m10-grouped-open-${scheme}.png`);
      const samples: Sample[] = [
        ["pill text", '[data-testid="group-pill"] p'],
        ["pill exit", '[data-testid="group-pill"] button'],
        ["close", '[data-testid="group-close"] text'],
      ];
      expect(await contrastFailures(page, samples)).toEqual([]);
    } finally {
      await close();
    }
  });

  it("keeps the group message at WCAG 2.2 AA", async () => {
    const { page, close } = await openPage({ scheme });
    try {
      await openGroupedFits(page);
      await press(group(page, BIG));
      await groupMessage(page).waitFor();
      await page.mouse.move(0, 0);
      await page.waitForTimeout(700);
      if (scheme === "light") await shot(page, "m10-group-too-big-light.png");
      const samples: Sample[] = [
        ["message", '[data-testid="group-message"] p'],
        ["narrow", '[data-testid="group-message"] button:nth-of-type(1)'],
        ["focus", '[data-testid="group-message"] button:nth-of-type(2)'],
      ];
      expect(await contrastFailures(page, samples)).toEqual([]);
    } finally {
      await close();
    }
  });
});
