import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium, type Browser, type Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PICTOGRAMS, saveConcept, setupStore, type Layer } from "@arch-mind/rules";
import { writePreview } from "../../capture/src/preview.ts";
import { startServer, type RunningServer } from "../src/app.ts";

const uiDir = fileURLToPath(new URL("../../ui/dist", import.meta.url));
const shotDir = process.env.ARCH_MIND_SCREENSHOT_DIR;
const VIEWPORT = { width: 1366, height: 768 };

const GENERIC: [string, Layer][] = [
  ["database", "data"],
  ["message-queue", "network"],
  ["background-worker", "server"],
  ["mutex-lock", "server"],
  ["encryption-key", "data"],
  ["cache", "client"],
  ["plugin-module", "client"],
  ["tenant-building", "server"],
  ["rate-gauge", "network"],
  ["gateway", "network"],
];

const ILLUSTRATION = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 140">
<title>A request passes a gateway</title>
<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8f0ff"/><stop offset="1" stop-color="#ffffff"/></linearGradient></defs>
<rect width="200" height="140" fill="url(#sky)"/>
<rect x="78" y="30" width="44" height="80" rx="4" fill="#9db8ef" stroke="#223" stroke-width="2"/>
<path d="M90 110V70A10 10 0 0 1 110 70V110Z" fill="#223"/>
<circle cx="24" cy="90" r="10" fill="#fff" stroke="#223" stroke-width="2"/>
<path d="M36 90H72" stroke="#223" stroke-width="3" fill="none"/>
<path d="M66 82L74 90L66 98" stroke="#223" stroke-width="3" fill="none"/>
<text x="100" y="22" font-size="12" text-anchor="middle" fill="#223" font-family="sans-serif">gateway</text>
</svg>`;

let dir: string;
let running: RunningServer;
let browser: Browser;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "arch-mind-illustration-e2e-"));
  const store = await setupStore(join(dir, "store"), join(dir, "config.json"));
  const base = { domains: ["web"], concerns: ["security"], relations: [], recall: [{ question: "q?" }] };
  for (const [id, layer] of GENERIC) {
    const saved = await saveConcept(store, {
      ...base,
      id,
      title: id.replace(/-/g, " "),
      layer,
      pictogram: id,
      seeI: { statement: `About ${id}.`, elaboration: "More.", example: "For example.", illustration: id === "gateway" ? "A request walks up to a gateway and passes through its single arch." : `A picture of ${id}.` },
      ...(id === "gateway" && { illustration: ILLUSTRATION }),
    });
    if (!saved.ok) throw new Error(JSON.stringify(saved.errors));
  }
  running = await startServer({ storePath: store, uiDir, port: 0 });
  browser = await chromium.launch({ channel: "chrome" });
});

afterAll(async () => {
  await browser?.close();
  await running?.close();
  await rm(dir, { recursive: true, force: true });
});

async function shot(page: Page, name: string) {
  if (!shotDir) return;
  await mkdir(shotDir, { recursive: true });
  await page.screenshot({ path: join(shotDir, name), animations: "disabled" });
}

async function choose(page: Page, id: string, title: string) {
  await page.locator(`[data-testid="concept"][data-id="${id}"]`).dispatchEvent("click");
  await page.getByTestId("concept-detail").locator("#concept-detail-title").getByText(title, { exact: true }).waitFor();
  await page.waitForTimeout(300);
}

async function open(scheme: "light" | "dark") {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, colorScheme: scheme });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${running.port}/`);
  await page.getByTestId("plates").waitFor();
  await page.getByTestId("concept").first().waitFor();
  await page.waitForTimeout(400);
  return { page, close: () => context.close() };
}

describe.each(["light", "dark"] as const)("the drawer illustration and the generic pictograms, %s mode (TST-034, AC-039, R-10)", (scheme) => {
  it("shows a concept's illustration only as an image with alt text, served with the restrictive headers", async () => {
    const { page, close } = await open(scheme);
    try {
      await page.locator('[data-testid="concept"][data-id="gateway"]').click();
      const drawer = page.getByTestId("concept-detail");
      await drawer.getByText(/Box \d · due/).first().waitFor();
      const img = drawer.getByTestId("concept-illustration");
      await img.waitFor();
      await page.waitForFunction(() => (document.querySelector('[data-testid="concept-illustration"]') as HTMLImageElement | null)?.complete === true);

      const facts = await drawer.evaluate((el) => {
        const image = el.querySelector('[data-testid="concept-illustration"]') as HTMLImageElement;
        const part = image.closest(".illustration-part")!;
        return {
          tag: image.tagName,
          src: new URL(image.src).pathname,
          alt: image.alt,
          naturalWidth: image.naturalWidth,
          svgInsidePart: part.querySelectorAll("svg, script, foreignObject").length,
          text: part.querySelector("p")?.textContent,
        };
      });
      expect(facts).toMatchObject({ tag: "IMG", src: "/api/concepts/gateway/illustration", svgInsidePart: 0 });
      expect(facts.naturalWidth).toBeGreaterThan(0);
      expect(facts.alt).toBe(facts.text);
      expect(facts.text).not.toContain("![");

      const res = await page.request.get(`http://127.0.0.1:${running.port}/api/concepts/gateway/illustration`);
      expect(res.headers()["content-security-policy"]).toBe("default-src 'none'; style-src 'unsafe-inline'; sandbox");
      expect(res.headers()["x-content-type-options"]).toBe("nosniff");

      await page.waitForTimeout(500);
      await shot(page, `m07-drawer-illustration-${scheme}.png`);

      await choose(page, "cache", "cache");
      expect(await drawer.getByTestId("concept-illustration").count()).toBe(0);
    } finally {
      await close();
    }
  });

  it("draws each of the ten generic pictograms on its plate and in the drawer", async () => {
    const { page, close } = await open(scheme);
    try {
      expect(GENERIC.map(([id]) => id).every((id) => PICTOGRAMS.some((p) => p.id === id))).toBe(true);
      const onPlates = await page.evaluate(() =>
        [...document.querySelectorAll('[data-testid="concept"]')].map((c) => {
          const use = c.querySelector("use") as SVGUseElement;
          const box = use.getBoundingClientRect();
          return { id: c.getAttribute("data-id"), href: use.getAttribute("href"), width: box.width, height: box.height, ink: c.querySelectorAll("use").length };
        }),
      );
      for (const [id] of GENERIC) {
        const found = onPlates.find((c) => c.id === id)!;
        expect(found.href, id).toBe(`#${id}`);
        expect(found.width, id).toBeGreaterThan(30);
        expect(found.height, id).toBeGreaterThan(20);
      }
      await shot(page, `m07-new-pictograms-plates-${scheme}.png`);

      const drawer = page.getByTestId("concept-detail");
      for (const [id] of GENERIC) {
        await choose(page, id, id.replace(/-/g, " "));
        const head = await drawer.locator(".drawer-head svg.pic").first().evaluate((svg) => {
          const use = svg.querySelector("use") as SVGUseElement;
          const art = document.getElementById(use.getAttribute("href")!.slice(1)) as unknown as SVGGraphicsElement;
          const bbox = art.getBBox();
          return { width: svg.getBoundingClientRect().width, href: use.getAttribute("href"), artWidth: bbox.width, artHeight: bbox.height };
        });
        expect(head, id).toMatchObject({ width: 64, href: `#${id}` });
        expect(head.artWidth, id).toBeGreaterThan(20);
        expect(head.artHeight, id).toBeGreaterThan(20);
      }
    } finally {
      await close();
    }
  });
});

describe("preview page", () => {
  it("shows the proposed SVG only through an img", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "arch-mind-preview-e2e-"));
    const context = await browser.newContext({ viewport: { width: 900, height: 640 }, deviceScaleFactor: 1 });
    try {
      const page = await context.newPage();
      const file = await writePreview("gateway", ILLUSTRATION, tempRoot);
      await page.goto(pathToFileURL(file).href);
      const img = page.locator("img");
      await img.waitFor();
      await page.waitForFunction(() => (document.querySelector("img") as HTMLImageElement).complete);
      expect(await img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      expect(await page.locator("svg, script").count()).toBe(0);
      await shot(page, "m07-preview-page.png");
    } finally {
      await context.close();
      await rm(tempRoot, { recursive: true, force: true });
    }
  });
});
