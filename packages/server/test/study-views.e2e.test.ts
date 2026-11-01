import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { overWideConcepts, tst032Concepts, tst032RelationCount } from "@arch-mind/rules/fixtures";
import { setupStore, writeConceptAtomic } from "@arch-mind/rules";
import { startServer, type RunningServer } from "../src/app.ts";

const uiDir = fileURLToPath(new URL("../../ui/dist", import.meta.url));
const shotDir = process.env.ARCH_MIND_SCREENSHOT_DIR;
const VIEWPORT = { width: 1366, height: 768 };

const secureAttr = tst032Concepts.find((c) => c.id === "secure-attr")!;
const hostPrefix = tst032Concepts.find((c) => c.id === "host-prefix")!;
const hostToSecure = hostPrefix.relations.find((r) => r.to === "secure-attr")!;
const clientRelations = tst032Concepts
  .filter((c) => c.layer === "client")
  .flatMap((c) => c.relations.filter((r) => tst032Concepts.find((t) => t.id === r.to)!.layer === "client"));

let dir: string;
let store: string;
let running: RunningServer;
let wide: RunningServer;
let browser: Browser;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "arch-mind-study-"));
  store = await setupStore(join(dir, "store"), join(dir, "config.json"));
  for (const concept of tst032Concepts) {
    const episodes = concept.id === "secure-attr" ? [{ project: "arch-mind", situation: "Cookies were dropped on localhost.", date: "2026-10-30" }] : [];
    await writeConceptAtomic(store, { ...concept, episodes });
  }
  await writeFile(join(store, "concepts", "broken.md"), "this is not a concept file");
  const reviewed = JSON.stringify({ question: "secure-attr#q1", at: new Date(2026, 10, 1, 12).toISOString(), result: "right" });
  await writeFile(join(store, "reviews.jsonl"), `${reviewed}\n`);
  running = await startServer({ storePath: store, uiDir, port: 0 });

  const wideStore = await setupStore(join(dir, "wide-store"), join(dir, "wide-config.json"));
  for (const concept of overWideConcepts) await writeConceptAtomic(wideStore, concept);
  wide = await startServer({ storePath: wideStore, uiDir, port: 0 });

  browser = await chromium.launch({ channel: "chrome" });
});

afterAll(async () => {
  await browser?.close();
  await running?.close();
  await wide?.close();
  await rm(dir, { recursive: true, force: true });
});

async function openPage(server: RunningServer, scheme: "light" | "dark" = "light"): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, colorScheme: scheme });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${server.port}/`);
  await page.waitForSelector('[data-testid="board"]');
  return { page, close: () => context.close() };
}

const connectors = (page: Page) => page.locator(".react-flow__node-connector");
const horizontalOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

async function hoverWire(page: Page, selector: string) {
  const point = await page.locator(selector).evaluate((g) => {
    const path = g.querySelector('path[stroke="transparent"]') as SVGPathElement;
    const at = path.getPointAtLength(path.getTotalLength() / 2);
    const m = path.getScreenCTM()!;
    return { x: at.x * m.a + at.y * m.c + m.e, y: at.x * m.b + at.y * m.d + m.f };
  });
  await page.mouse.move(point.x, point.y);
}

describe("layer view width (ASM-1, Amendment 1)", () => {
  it("draws the TST-032 layout within 95% of the board width at 1366 x 768", async () => {
    const { page, close } = await openPage(running);
    try {
      await connectors(page).first().waitFor();
      await page.waitForFunction((n) => document.querySelectorAll(".react-flow__edge").length === n, tst032RelationCount);
      const m = await page.evaluate(() => {
        const rects = [...document.querySelectorAll(".react-flow__node-connector")].map((n) => n.getBoundingClientRect());
        return {
          boardWidth: document.querySelector('[data-testid="board"]')!.getBoundingClientRect().width,
          sidebarWidth: document.querySelector("aside")!.getBoundingClientRect().width,
          layoutWidth: Math.max(...rects.map((r) => r.right)) - Math.min(...rects.map((r) => r.left)) + 32,
        };
      });
      process.stdout.write(`TST-032 Chrome layout ${m.layoutWidth} px in a ${m.boardWidth} px board (sidebar ${m.sidebarWidth} px)
`);
      expect(m.sidebarWidth).toBeLessThanOrEqual(200);
      expect(m.layoutWidth).toBeLessThanOrEqual(m.boardWidth * 0.95);
    } finally {
      await close();
    }
  });
});

describe("filters (AC-1)", () => {
  it("changes the drawn connectors and wires in the layer view and the rows in the matrix", async () => {
    const { page, close } = await openPage(running);
    try {
      await connectors(page).first().waitFor();
      await page.waitForFunction((n) => document.querySelectorAll(".react-flow__edge").length === n, tst032RelationCount);
      expect(await connectors(page).count()).toBe(13);

      await page.getByRole("checkbox", { name: "client", exact: true }).check();
      await page.waitForFunction((n) => document.querySelectorAll(".react-flow__node-connector").length === n, 6);
      await page.waitForFunction((n) => document.querySelectorAll(".react-flow__edge").length === n, clientRelations.length);

      await page.getByRole("button", { name: "Matrix" }).click();
      expect(await page.locator("tbody tr").count()).toBe(6);

      await page.getByRole("checkbox", { name: "mobile", exact: true }).check();
      expect(await page.locator("tbody tr").count()).toBe(0);
      await page.getByRole("button", { name: "Layers" }).click();
      await page.waitForFunction(() => document.querySelectorAll(".react-flow__node-connector").length === 0);

      await page.getByRole("button", { name: "Clear filters" }).click();
      await page.waitForFunction((n) => document.querySelectorAll(".react-flow__node-connector").length === n, 13);
    } finally {
      await close();
    }
  });

  it("groups each facet in a fieldset with a legend", async () => {
    const { page, close } = await openPage(running);
    try {
      await page.waitForSelector("aside fieldset > legend");
      const legends = await page.locator("aside fieldset > legend").allTextContents();
      expect(legends).toEqual(["Layers", "Domains", "Concerns"]);
    } finally {
      await close();
    }
  });
});

describe.each(["light", "dark"] as const)("matrix view at 1366 x 768, %s mode (AC-2)", (scheme) => {
  it("fills 13 rows and columns, holds every relation and does not scroll sideways", async () => {
    const { page, close } = await openPage(running, scheme);
    try {
      await page.getByRole("button", { name: "Matrix" }).click();
      await page.waitForSelector("tbody tr");
      expect(await page.locator("tbody tr").count()).toBe(13);
      expect(await page.locator("thead th").count()).toBe(13);
      expect(await page.locator("tbody td button").count()).toBe(tst032RelationCount);
      expect(await page.getByTestId("fit-message").count()).toBe(0);
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
      if (shotDir) {
        await mkdir(shotDir, { recursive: true });
        await page.screenshot({ path: join(shotDir, `matrix-view-1366x768-${scheme}.png`), fullPage: true, animations: "disabled" });
      }
    } finally {
      await close();
    }
  });
});

describe("relation details (AC-3)", () => {
  it("shows source and explanation when a wire is hovered", async () => {
    const { page, close } = await openPage(running);
    try {
      await page.waitForFunction((n) => document.querySelectorAll(".react-flow__edge").length === n, tst032RelationCount);
      await hoverWire(page, '.wire[aria-label*="__Host- cookie prefix to"]');
      const popover = page.getByTestId("relation-popover");
      await popover.waitFor();
      expect(await popover.textContent()).toContain(hostToSecure.source);
      expect(await popover.textContent()).toContain(hostToSecure.explanation);
      await page.mouse.move(2, 2);
      await popover.waitFor({ state: "detached" });
    } finally {
      await close();
    }
  });

  it("shows the same details when a wire is focused, and keeps a pressed one open until Escape", async () => {
    const { page, close } = await openPage(running);
    try {
      await page.waitForFunction((n) => document.querySelectorAll(".react-flow__edge").length === n, tst032RelationCount);
      const wire = page.locator('.wire[aria-label*="__Host- cookie prefix to"]');
      await wire.focus();
      const popover = page.getByTestId("relation-popover");
      expect(await popover.textContent()).toContain(hostToSecure.explanation);
      await page.keyboard.press("Enter");
      await page.locator("body").focus();
      expect(await popover.count()).toBe(1);
      await page.keyboard.press("Escape");
      expect(await popover.count()).toBe(0);
    } finally {
      await close();
    }
  });

  it("shows source and explanation when a matrix cell is focused", async () => {
    const { page, close } = await openPage(running);
    try {
      await page.getByRole("button", { name: "Matrix" }).click();
      await page.locator('tbody td button[aria-label*="__Host- cookie prefix to"]').first().focus();
      const popover = page.getByTestId("relation-popover");
      await popover.waitFor();
      expect(await popover.textContent()).toContain(hostToSecure.source);
      expect(await popover.textContent()).toContain(hostToSecure.explanation);
    } finally {
      await close();
    }
  });
});

describe("relation details in the last matrix row (AC-3)", () => {
  it("keeps the popover of the bottom-most cell readable inside the viewport", async () => {
    const { page, close } = await openPage(running);
    try {
      const sends = tst032Concepts.flatMap((c) => c.relations).find((r) => r.type === "sends")!;
      await page.getByRole("button", { name: "Matrix" }).click();
      await page.waitForSelector("tbody tr");
      const cell = page.locator(`tbody td button[aria-label^="sends:"]`).first();
      await cell.focus();
      const popover = page.getByTestId("relation-popover");
      await popover.waitFor();
      expect(await popover.textContent()).toContain(sends.source);
      expect(await popover.textContent()).toContain(sends.explanation);
      const box = (await popover.boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(768);
      expect(box.x + box.width).toBeLessThanOrEqual(1366);
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    } finally {
      await close();
    }
  });
});

describe.each(["light", "dark"] as const)("concept detail at 1366 x 768, %s mode (AC-5)", (scheme) => {
  it("opens from a clicked connector with SEE-I, relations, episodes, facets and each question's box and due date", async () => {
    const { page, close } = await openPage(running, scheme);
    try {
      const opener = connectors(page).getByRole("button", { name: /Secure cookie attribute/ });
      await opener.waitFor();
      await opener.click();
      const dialog = page.getByRole("dialog", { name: "Secure cookie attribute" });
      await dialog.getByText("Box 2 · due 2026-11-04").waitFor();
      const text = (await dialog.textContent()) ?? "";
      for (const part of Object.values(secureAttr.seeI)) expect(text).toContain(part);
      for (const r of secureAttr.relations) {
        expect(text).toContain(r.source);
        expect(text).toContain(r.explanation);
      }
      expect(text).toContain("Cookies were dropped on localhost.");
      expect(text).toContain("web");
      expect(text).toContain("security");
      expect(text).toContain(secureAttr.recall[0]!.question);
      if (shotDir) {
        await mkdir(shotDir, { recursive: true });
        await page.screenshot({ path: join(shotDir, `concept-detail-1366x768-${scheme}.png`), animations: "disabled" });
      }

      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "detached" });
      expect(await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))).toContain("Secure cookie attribute");
    } finally {
      await close();
    }
  });
});

describe("concept detail from the matrix (AC-5)", () => {
  it("opens with Enter on a focused row header, shows a fresh question in box 1, and closes with the button", async () => {
    const { page, close } = await openPage(running);
    try {
      await page.getByRole("button", { name: "Matrix" }).click();
      const header = page.locator("tbody th button", { hasText: "__Host- cookie prefix" });
      await header.focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog", { name: "__Host- cookie prefix" });
      await dialog.getByText("Box 1 · due 2026-10-31").waitFor();
      await dialog.getByRole("button", { name: "Close" }).click();
      await dialog.waitFor({ state: "detached" });
      expect(await header.evaluate((el) => el === document.activeElement)).toBe(true);
    } finally {
      await close();
    }
  });
});

describe("problems and hand edits (AC-8)", () => {
  it("lists the unreadable file with its reason and shows a hand edit after reload", async () => {
    const { page, close } = await openPage(running);
    try {
      const problems = page.getByTestId("problems");
      await problems.waitFor();
      expect(await problems.textContent()).toContain("broken.md");
      expect(await problems.textContent()).toContain("missing YAML frontmatter");

      const file = join(store, "concepts", "secure-attr.md");
      await writeFile(file, (await readFile(file, "utf8")).replace("title: Secure cookie attribute", "title: Secure cookie attribute (hand edited)"));
      await page.reload();
      await connectors(page).getByRole("button", { name: /Secure cookie attribute \(hand edited\)/ }).waitFor();
    } finally {
      await close();
    }
  });
});

describe("keyboard operation (AC-9)", () => {
  it("reaches connectors with Tab and shows a visible focus ring", async () => {
    const { page, close } = await openPage(running);
    try {
      await connectors(page).first().waitFor();
      for (let i = 0; i < 40; i++) {
        await page.keyboard.press("Tab");
        if (await page.evaluate(() => document.activeElement?.closest(".react-flow__node-connector") !== null)) break;
      }
      const ring = await page.evaluate(() => {
        const style = getComputedStyle(document.activeElement!);
        return { inNode: document.activeElement!.closest(".react-flow__node-connector") !== null, width: style.outlineWidth, style: style.outlineStyle };
      });
      expect(ring.inNode).toBe(true);
      expect(ring.style).not.toBe("none");
      expect(ring.width).toBe("2px");
    } finally {
      await close();
    }
  });
});

describe("width guard (TST-014, AC-4)", () => {
  it("shows the fit message and no board for a layout wider than the screen, then draws once narrowed", async () => {
    const { page, close } = await openPage(wide);
    try {
      const message = page.getByTestId("fit-message");
      await message.waitFor();
      expect(await message.textContent()).toMatch(/narrow/);
      expect(await connectors(page).count()).toBe(0);
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

      await page.getByRole("checkbox", { name: "client", exact: true }).check();
      await connectors(page).first().waitFor();
      expect(await message.count()).toBe(0);
      expect(await connectors(page).count()).toBe(1);
    } finally {
      await close();
    }
  });
});
