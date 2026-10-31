import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { tst032Concepts, tst032RelationCount } from "@arch-mind/rules/fixtures";
import { setupStore, writeConceptAtomic } from "@arch-mind/rules";
import { startServer, type RunningServer } from "../src/app.ts";

const uiDir = fileURLToPath(new URL("../../ui/dist", import.meta.url));
const shotDir = process.env.ARCH_MIND_SCREENSHOT_DIR;

let dir: string;
let running: RunningServer;
let browser: Browser;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "arch-mind-e2e-"));
  const store = await setupStore(join(dir, "store"), join(dir, "config.json"));
  for (const concept of tst032Concepts) await writeConceptAtomic(store, concept);
  running = await startServer({ storePath: store, uiDir, port: 0 });
  // Uses the installed Chrome: no browser is downloaded.
  browser = await chromium.launch({ channel: "chrome" });
});

afterAll(async () => {
  await browser?.close();
  await running?.close();
  await rm(dir, { recursive: true, force: true });
});

describe.each(["light", "dark"] as const)("layer view at 1366 x 768, %s mode (TST-008, AC-4, AC-7, AC-8)", (scheme) => {
  it("shows the TST-032 fixture in four ordered bands with labeled arrows and no horizontal overflow", async () => {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1, colorScheme: scheme });
    const page = await context.newPage();
    try {
      await page.goto(`http://127.0.0.1:${running.port}/`);
      await page.waitForSelector(".react-flow__node-connector");
      await page.waitForFunction((n) => document.querySelectorAll(".react-flow__edge").length === n, tst032RelationCount);
      await page.waitForTimeout(300);

      const m = await page.evaluate(() => {
        const rect = (el: Element) => el.getBoundingClientRect();
        const root = document.documentElement;
        const board = document.querySelector('[data-testid="board"]')!;
        return {
          innerWidth: window.innerWidth,
          scrollWidth: root.scrollWidth,
          clientWidth: root.clientWidth,
          zoom: board.getAttribute("data-zoom"),
          boardRight: rect(board).right,
          connectors: document.querySelectorAll(".react-flow__node-connector").length,
          edges: document.querySelectorAll(".react-flow__edge").length,
          labels: [...document.querySelectorAll(".react-flow__edge-text")].map((e) => e.textContent),
          bands: [...document.querySelectorAll(".react-flow__node-band")].map((b) => ({ name: b.textContent, top: rect(b).top, bottom: rect(b).bottom })),
          nodeRights: [...document.querySelectorAll(".react-flow__node-connector")].map((n) => rect(n).right),
          fonts: getComputedStyle(document.body).fontFamily,
        };
      });
      console.log(`${scheme}: scrollWidth=${m.scrollWidth} clientWidth=${m.clientWidth} innerWidth=${m.innerWidth} zoom=${m.zoom}`);

      expect(m.scrollWidth).toBeLessThanOrEqual(1366);
      expect(m.scrollWidth).toBeLessThanOrEqual(m.clientWidth);
      expect(m.zoom).toBe("1");
      expect(Math.max(...m.nodeRights)).toBeLessThanOrEqual(m.boardRight);
      expect(m.connectors).toBe(13);
      expect(m.edges).toBe(tst032RelationCount);
      expect(m.labels).toContain("requires");
      expect(m.labels).toContain("complements");
      expect(m.bands.map((b) => b.name)).toEqual(["client", "network", "server", "data"]);
      for (let i = 1; i < m.bands.length; i++) expect(m.bands[i]!.top).toBeGreaterThanOrEqual(m.bands[i - 1]!.bottom);
      expect(m.fonts).toContain("Inter");

      if (shotDir) {
        await mkdir(shotDir, { recursive: true });
        await page.screenshot({ path: join(shotDir, `layer-view-1366x768-${scheme}.png`), fullPage: true });
      }
    } finally {
      await context.close();
    }
  });
});
