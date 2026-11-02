import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { overWideConcepts, tst032Concepts } from "@arch-mind/rules/fixtures";
import { setupStore, writeConceptAtomic, type Concept } from "@arch-mind/rules";
import { startServer, type RunningServer } from "../src/app.ts";
import { contrastFailures, type Sample } from "./contrast.ts";

const uiDir = fileURLToPath(new URL("../../ui/dist", import.meta.url));
const shotDir = process.env.ARCH_MIND_SCREENSHOT_DIR;
const VIEWPORT = { width: 1366, height: 768 };
// The board is 612 px wide here, so the 13-concept matrix (636 px) is refused while a two-concept plate still fits.
const NARROW_VIEWPORT = { width: 860, height: 768 };

const COMPACT = "secure-attr";
const OTHER = "host-prefix";
const DOMAINS = ["accounting", "billing", "catalog", "checkout", "delivery", "discounts", "identity", "inventory", "invoicing", "logistics", "messaging", "onboarding", "payments", "pricing", "refunds", "reporting", "returns", "search", "shipping", "support"];

const byId = (id: string) => tst032Concepts.find((c) => c.id === id)!;
const connected = (concepts: Concept[], id: string) => {
  const own = concepts.find((c) => c.id === id)!.relations.map((r) => r.to);
  const pointing = concepts.filter((c) => c.relations.some((r) => r.to === id)).map((c) => c.id);
  return [...new Set([id, ...own, ...pointing])].sort();
};

let dir: string;
let running: RunningServer;
let wide: RunningServer;
let many: RunningServer;
let browser: Browser;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "arch-mind-focus-"));
  const store = await setupStore(join(dir, "store"), join(dir, "config.json"));
  for (const concept of tst032Concepts) await writeConceptAtomic(store, concept);
  running = await startServer({ storePath: store, uiDir, port: 0 });

  const wideStore = await setupStore(join(dir, "wide-store"), join(dir, "wide-config.json"));
  for (const concept of overWideConcepts) await writeConceptAtomic(wideStore, concept);
  wide = await startServer({ storePath: wideStore, uiDir, port: 0 });

  // Twenty domain values wrap far past three rows in the 200 px island; the concerns stay the seeded three.
  const manyStore = await setupStore(join(dir, "many-store"), join(dir, "many-config.json"));
  await writeFile(
    join(manyStore, "facets.yaml"),
    `domains:\n${DOMAINS.map((d) => `  - ${d}\n`).join("")}concerns:\n  - security\n  - performance\n  - reliability\nleitnerIntervalsDays: [1, 3, 7, 16, 35]\n`,
  );
  for (const [i, domain] of ["billing", "identity", "search"].entries()) {
    await writeConceptAtomic(manyStore, { ...byId(COMPACT), id: `m-${i + 1}`, title: `Many ${i + 1}`, domains: [domain], concerns: ["security"], relations: [] });
  }
  many = await startServer({ storePath: manyStore, uiDir, port: 0 });

  browser = await chromium.launch({ channel: "chrome" });
});

afterAll(async () => {
  await browser?.close();
  await running?.close();
  await wide?.close();
  await many?.close();
  await rm(dir, { recursive: true, force: true });
});

async function openPage(server: RunningServer, options: { scheme?: "light" | "dark"; view?: "Layers" | "Matrix"; viewport?: { width: number; height: number } } = {}) {
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
  await mkdir(shotDir, { recursive: true });
  await page.screenshot({ path: join(shotDir, name), animations: "disabled" });
}

const concept = (page: Page, id: string) => page.locator(`[data-testid="concept"][data-id="${id}"]`);
const drawer = (page: Page) => page.getByTestId("concept-detail");
const pill = (page: Page) => page.getByTestId("focus-pill");
const message = (page: Page) => page.getByTestId("fit-message");
const finder = (page: Page) => page.getByRole("dialog", { name: "Find a concept" });
const filters = (page: Page) => page.getByRole("complementary", { name: "Filters" });
const announcement = (page: Page) => page.locator('p.sr-only[role="status"]');
const drawnIds = (page: Page) => page.getByTestId("concept").evaluateAll((all) => all.map((c) => c.getAttribute("data-id")!).sort());
const focusButton = (page: Page) => drawer(page).getByRole("button", { name: "Focus", exact: true });
const wirePressed = (page: Page) =>
  page.locator("section[aria-labelledby=wires-title] button").evaluateAll((all) => all.filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.getAttribute("aria-label")));

async function selectConcept(page: Page, id: string) {
  await concept(page, id).click();
  await drawer(page).waitFor();
}

async function chooseInFinder(page: Page, query: string) {
  await finder(page).waitFor();
  await page.getByRole("combobox").fill(query);
  await page.keyboard.press("Enter");
  await finder(page).waitFor({ state: "detached" });
}

describe("would-not-fit choices (TST-041, AC-045, AC-047)", () => {
  it("offers both choices on the refused layer view and takes neither on its own", async () => {
    const { page, close } = await openPage(wide);
    try {
      await message(page).waitFor();
      expect(await message(page).textContent()).toMatch(/narrow/);
      expect(await message(page).textContent()).toMatch(/85 %/);
      expect(await message(page).getByRole("button").allTextContents()).toEqual(["Narrow the filters", "Focus on a concept"]);
      await page.waitForTimeout(300);
      expect(await finder(page).count()).toBe(0);
      expect(await pill(page).count()).toBe(0);
      expect(await page.getByRole("button", { name: "All" }).first().getAttribute("aria-pressed")).toBe("true");
      await shot(page, "fit-message-layers-light.png");
    } finally {
      await close();
    }
  });

  it("moves keyboard focus to the filters island and expands it when 'Narrow the filters' is pressed", async () => {
    const { page, close } = await openPage(wide);
    try {
      await message(page).waitFor();
      await filters(page).getByRole("button", { name: "Filters" }).click();
      expect(await filters(page).getByRole("button", { name: "Filters" }).getAttribute("aria-expanded")).toBe("false");

      await page.getByRole("button", { name: "Narrow the filters" }).click();
      expect(await filters(page).getByRole("button", { name: "Filters" }).getAttribute("aria-expanded")).toBe("true");
      expect(await filters(page).evaluate((el) => el.contains(document.activeElement))).toBe(true);
      await page.keyboard.press("Space");
      expect(await filters(page).getByRole("button", { name: "Filters" }).getAttribute("aria-expanded")).toBe("false");
    } finally {
      await close();
    }
  });

  it("opens the finder from 'Focus on a concept' and focuses the chosen spoke at Fit 0.85 or more with no horizontal scroll", async () => {
    const { page, close } = await openPage(wide);
    try {
      await message(page).waitFor();
      await page.getByRole("button", { name: "Focus on a concept" }).click();
      await chooseInFinder(page, "Wide spoke 1");
      await drawer(page).waitFor();
      await expect.poll(() => drawnIds(page)).toEqual(["wide-1", "wide-hub"]);
      expect(await message(page).count()).toBe(0);
      await pill(page).waitFor();
      expect(await pill(page).locator("p").getAttribute("title")).toContain("Wide spoke 1");
      const scale = Number(await page.getByTestId("plates").getAttribute("data-fit-scale"));
      expect(scale).toBeGreaterThanOrEqual(0.85);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    } finally {
      await close();
    }
  });

  it("shows the message again in focus when the chosen hub's neighbourhood would not fit, with the same two choices", async () => {
    const { page, close } = await openPage(wide);
    try {
      await message(page).waitFor();
      await page.getByRole("button", { name: "Focus on a concept" }).click();
      await chooseInFinder(page, "Wide hub");
      await drawer(page).waitFor();
      await pill(page).waitFor();
      await message(page).waitFor();
      expect(await message(page).getByRole("button").allTextContents()).toEqual(["Narrow the filters", "Focus on a concept"]);
    } finally {
      await close();
    }
  });

  it("offers both choices on the refused matrix, keeps the matrix for 'Narrow the filters' and opens the layer view focused for 'Focus on a concept'", async () => {
    const { page, close } = await openPage(running, { view: "Matrix", viewport: NARROW_VIEWPORT });
    try {
      await message(page).waitFor();
      expect(await message(page).getByRole("button").allTextContents()).toEqual(["Narrow the filters", "Focus on a concept"]);
      expect(await page.locator("table").count()).toBe(0);
      await shot(page, "fit-message-matrix-light.png");

      await page.getByRole("button", { name: "Narrow the filters" }).click();
      expect(await filters(page).evaluate((el) => el.contains(document.activeElement))).toBe(true);
      expect(await page.getByTestId("board").getAttribute("data-view")).toBe("matrix");
      expect(await pill(page).count()).toBe(0);

      await page.getByRole("button", { name: "Focus on a concept" }).click();
      await chooseInFinder(page, byId(OTHER).title);
      await expect.poll(() => page.getByTestId("board").getAttribute("data-view")).toBe("layers");
      await pill(page).waitFor();
      await expect.poll(() => drawnIds(page)).toEqual(connected(tst032Concepts, OTHER));
    } finally {
      await close();
    }
  });

  it("keeps the matrix and draws it once the filters are narrowed", async () => {
    const { page, close } = await openPage(running, { view: "Matrix", viewport: NARROW_VIEWPORT });
    try {
      await message(page).waitFor();
      await page.getByRole("button", { name: "Narrow the filters" }).click();
      await page.getByRole("checkbox", { name: "client", exact: true }).check();
      await page.locator("tbody tr").first().waitFor();
      expect(await page.getByTestId("board").getAttribute("data-view")).toBe("matrix");
      expect(await message(page).count()).toBe(0);
    } finally {
      await close();
    }
  });
});

describe("focus (R-2)", () => {
  it("turns on from the drawer's Focus button, draws only the focused set and leaves with the pill's Exit keeping the selection", async () => {
    const { page, close } = await openPage(running);
    try {
      await concept(page, COMPACT).waitFor();
      await selectConcept(page, COMPACT);
      expect(await focusButton(page).getAttribute("aria-pressed")).toBe("false");
      await focusButton(page).click();
      await pill(page).waitFor();
      expect(await focusButton(page).getAttribute("aria-pressed")).toBe("true");
      expect(await pill(page).textContent()).toMatch(/^Focused on \S+ · Exit$/);
      expect(await pill(page).locator("p").getAttribute("title")).toContain(byId(COMPACT).title);
      await expect.poll(() => drawnIds(page)).toEqual(connected(tst032Concepts, COMPACT));
      expect(await concept(page, COMPACT).getAttribute("data-state")).toBe("selected");
      await page.waitForTimeout(600);
      await shot(page, "focus-light.png");

      await pill(page).getByRole("button", { name: "Exit" }).click();
      await pill(page).waitFor({ state: "detached" });
      await expect.poll(() => page.getByTestId("concept").count()).toBe(tst032Concepts.length);
      expect(await drawer(page).count()).toBe(1);
      expect(await concept(page, COMPACT).getAttribute("data-state")).toBe("selected");
    } finally {
      await close();
    }
  });

  it("turns on with F once a concept is selected, and not while typing or in Review", async () => {
    const { page, close } = await openPage(running);
    try {
      await concept(page, COMPACT).waitFor();
      await page.keyboard.press("f");
      expect(await pill(page).count()).toBe(0);

      await selectConcept(page, COMPACT);
      await page.keyboard.press("Control+k");
      await finder(page).waitFor();
      await page.keyboard.type("f");
      expect(await pill(page).count()).toBe(0);
      await page.keyboard.press("Escape");
      await finder(page).waitFor({ state: "detached" });

      await page.getByRole("button", { name: "Review" }).click();
      await page.keyboard.press("f");
      await page.waitForTimeout(150);
      expect(await pill(page).count()).toBe(0);
      await page.getByRole("button", { name: "Layers" }).click();
      expect(await pill(page).count()).toBe(0);

      await page.keyboard.press("f");
      await pill(page).waitFor();
      await expect.poll(() => drawnIds(page)).toEqual(connected(tst032Concepts, COMPACT));
    } finally {
      await close();
    }
  });

  it("does not take F typed into a facet search field", async () => {
    const { page, close } = await openPage(many);
    try {
      await page.getByTestId("concept").first().waitFor();
      await page.getByTestId("concept").first().click();
      await drawer(page).waitFor();
      const search = page.getByRole("searchbox", { name: "Search Domains" });
      await search.focus();
      await page.keyboard.press("f");
      await page.keyboard.type("F");
      expect(await search.inputValue()).toBe("fF");
      expect(await pill(page).count()).toBe(0);
    } finally {
      await close();
    }
  });

  it("opens the layer view focused when Focus is used from the matrix", async () => {
    const { page, close } = await openPage(running, { view: "Matrix" });
    try {
      await page.locator("tbody th button", { hasText: byId(COMPACT).title }).first().click();
      await drawer(page).waitFor();
      await focusButton(page).click();
      await expect.poll(() => page.getByTestId("board").getAttribute("data-view")).toBe("layers");
      await pill(page).waitFor();
      await expect.poll(() => drawnIds(page)).toEqual(connected(tst032Concepts, COMPACT));

      await pill(page).getByRole("button", { name: "Exit" }).click();
      await page.getByRole("button", { name: "Matrix" }).click();
      await page.keyboard.press("f");
      await expect.poll(() => page.getByTestId("board").getAttribute("data-view")).toBe("layers");
      await pill(page).waitFor();
    } finally {
      await close();
    }
  });

  it("keeps the plate designators on the numbering of the shown concepts, the same the drawer and its relation rows use", async () => {
    const { page, close } = await openPage(running);
    try {
      await concept(page, COMPACT).waitFor();
      await selectConcept(page, COMPACT);
      const plateName = (id: string) => concept(page, id).getAttribute("aria-label");
      const selectedName = (await plateName(COMPACT))!;
      await page.keyboard.press("f");
      await pill(page).waitFor();
      await expect.poll(() => drawnIds(page)).toEqual(connected(tst032Concepts, COMPACT));

      const designator = (name: string) => name.split(" ")[0]!;
      expect(designator(await plateName(COMPACT) as string)).toBe(designator(selectedName));
      expect(await drawer(page).getByTestId("layer-pill").textContent()).toContain(designator(selectedName));
      expect(await pill(page).textContent()).toContain(`Focused on ${designator(selectedName)} `);

      const row = drawer(page).getByTestId("relation-row").first();
      const otherId = (await row.getAttribute("data-other"))!;
      expect(await row.textContent()).toContain((await plateName(otherId))!);
    } finally {
      await close();
    }
  });

  it("ends when the view changes to the matrix or Review, and the drawer offers no Focus button in Review", async () => {
    const { page, close } = await openPage(running);
    try {
      await concept(page, COMPACT).waitFor();
      await selectConcept(page, COMPACT);
      for (const view of ["Matrix", "Review"]) {
        await page.keyboard.press("f");
        await pill(page).waitFor();
        await page.getByRole("button", { name: view }).click();
        await pill(page).waitFor({ state: "detached" });
        if (view === "Review") expect(await focusButton(page).count()).toBe(0);
        await page.getByRole("button", { name: "Layers" }).click();
        await expect.poll(() => page.getByTestId("concept").count()).toBe(tst032Concepts.length);
        expect(await pill(page).count()).toBe(0);
        expect(await focusButton(page).getAttribute("aria-pressed")).toBe("false");
      }
    } finally {
      await close();
    }
  });

  it("follows the selection to a relation row, and leaves when the selection is cleared without resuming on the next one", async () => {
    const { page, close } = await openPage(running);
    try {
      await concept(page, COMPACT).waitFor();
      await selectConcept(page, COMPACT);
      await page.keyboard.press("f");
      await pill(page).waitFor();

      const row = drawer(page).getByTestId("relation-row").first();
      const otherId = (await row.getAttribute("data-other"))!;
      await row.getByRole("button").click();
      await expect.poll(() => pill(page).locator("p").getAttribute("title")).toContain(byId(otherId).title);
      await expect.poll(() => drawnIds(page)).toEqual(connected(tst032Concepts, otherId));

      await drawer(page).getByRole("button", { name: "Close" }).click();
      await pill(page).waitFor({ state: "detached" });
      await expect.poll(() => page.getByTestId("concept").count()).toBe(tst032Concepts.length);

      await selectConcept(page, COMPACT);
      expect(await pill(page).count()).toBe(0);
      expect(await page.getByTestId("concept").count()).toBe(tst032Concepts.length);
    } finally {
      await close();
    }
  });

  it("follows a concept chosen in the finder while focused", async () => {
    const { page, close } = await openPage(running);
    try {
      await concept(page, COMPACT).waitFor();
      await selectConcept(page, COMPACT);
      await page.keyboard.press("f");
      await pill(page).waitFor();
      await page.keyboard.press("Control+k");
      await chooseInFinder(page, byId(OTHER).title);
      await expect.poll(() => pill(page).locator("p").getAttribute("title")).toContain(byId(OTHER).title);
      await expect.poll(() => drawnIds(page)).toEqual(connected(tst032Concepts, OTHER));
    } finally {
      await close();
    }
  });

  it("is never stored: no URL change, no browser storage and no request other than GET", async () => {
    const { page, close } = await openPage(running);
    try {
      const writes: string[] = [];
      page.on("request", (r) => r.method() !== "GET" && writes.push(`${r.method()} ${r.url()}`));
      await concept(page, COMPACT).waitFor();
      const before = page.url();
      await selectConcept(page, COMPACT);
      await page.keyboard.press("f");
      await pill(page).waitFor();
      await page.keyboard.press("Escape");
      await pill(page).waitFor({ state: "detached" });
      expect(page.url()).toBe(before);
      expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
      expect(writes).toEqual([]);
    } finally {
      await close();
    }
  });

  it("announces when focus starts and ends through a polite live region", async () => {
    const { page, close } = await openPage(running);
    try {
      await concept(page, COMPACT).waitFor();
      expect(await announcement(page).getAttribute("aria-live")).toBe("polite");
      await selectConcept(page, COMPACT);
      await page.keyboard.press("f");
      await expect.poll(() => announcement(page).textContent()).toContain(`Focused on`);
      expect(await announcement(page).textContent()).toContain(byId(COMPACT).title);
      await page.keyboard.press("Escape");
      await expect.poll(() => announcement(page).textContent()).toBe("Focus ended");
    } finally {
      await close();
    }
  });

  it("keeps the pill clear of the top islands at 1366 x 768 with the drawer open", async () => {
    const { page, close } = await openPage(running);
    try {
      await concept(page, COMPACT).waitFor();
      await selectConcept(page, COMPACT);
      await page.keyboard.press("f");
      await pill(page).waitFor();
      await page.waitForTimeout(600);
      const boxes = await page.evaluate(() => {
        const rect = (el: Element | null) => {
          const r = el!.getBoundingClientRect();
          return { left: r.left, right: r.right };
        };
        const islands = [...document.querySelectorAll(".island")].filter((el) => el.getBoundingClientRect().top < 40 && !el.matches('[data-testid="focus-pill"]'));
        return { pill: rect(document.querySelector('[data-testid="focus-pill"]')), islands: islands.map(rect) };
      });
      expect(boxes.islands.length).toBe(2);
      for (const island of boxes.islands) expect(boxes.pill.right <= island.left || boxes.pill.left >= island.right).toBe(true);
    } finally {
      await close();
    }
  });
});

describe("Escape order (R-6)", () => {
  it("closes the finder first, then leaves focus keeping the drawer, then closes the drawer, then the legend type", async () => {
    const { page, close } = await openPage(running);
    try {
      await concept(page, COMPACT).waitFor();
      await page.locator("section[aria-labelledby=wires-title]").getByRole("button", { name: "requires", exact: true }).click();
      await selectConcept(page, COMPACT);
      await page.keyboard.press("f");
      await pill(page).waitFor();

      await page.keyboard.press("Control+k");
      await finder(page).waitFor();
      await page.keyboard.press("Escape");
      await finder(page).waitFor({ state: "detached" });
      expect(await pill(page).count()).toBe(1);
      expect(await drawer(page).count()).toBe(1);

      await page.keyboard.press("Escape");
      await pill(page).waitFor({ state: "detached" });
      expect(await drawer(page).count()).toBe(1);
      expect(await concept(page, COMPACT).getAttribute("data-state")).toBe("selected");
      expect(await wirePressed(page)).toEqual(["requires"]);

      await page.keyboard.press("Escape");
      await drawer(page).waitFor({ state: "detached" });
      expect(await wirePressed(page)).toEqual(["requires"]);

      await page.keyboard.press("Escape");
      await expect.poll(() => wirePressed(page)).toEqual([]);
    } finally {
      await close();
    }
  });
});

describe("Escape closes one layer at a time, a pinned popover first", () => {
  const pinWire = async (page: Page) => {
    await page.getByTestId("wire").first().focus();
    await page.keyboard.press("Enter");
    await page.getByTestId("relation-popover").waitFor();
  };

  it("with focus on: popover, then focus, then drawer", async () => {
    const { page, close } = await openPage(running);
    try {
      await concept(page, COMPACT).waitFor();
      await selectConcept(page, COMPACT);
      await page.keyboard.press("f");
      await pill(page).waitFor();
      await pinWire(page);

      await page.keyboard.press("Escape");
      await page.getByTestId("relation-popover").waitFor({ state: "detached" });
      expect(await pill(page).count()).toBe(1);
      expect(await drawer(page).count()).toBe(1);

      await page.keyboard.press("Escape");
      await pill(page).waitFor({ state: "detached" });
      expect(await drawer(page).count()).toBe(1);

      await page.keyboard.press("Escape");
      await drawer(page).waitFor({ state: "detached" });
    } finally {
      await close();
    }
  });

  it("with focus off: popover, then drawer", async () => {
    const { page, close } = await openPage(running);
    try {
      await concept(page, COMPACT).waitFor();
      await selectConcept(page, COMPACT);
      await pinWire(page);

      await page.keyboard.press("Escape");
      await page.getByTestId("relation-popover").waitFor({ state: "detached" });
      expect(await drawer(page).count()).toBe(1);

      await page.keyboard.press("Escape");
      await drawer(page).waitFor({ state: "detached" });
    } finally {
      await close();
    }
  });

  it("leaves a pinned popover open when Escape closes the finder, then closes the popover before the drawer", async () => {
    const { page, close } = await openPage(running);
    try {
      await concept(page, COMPACT).waitFor();
      await selectConcept(page, COMPACT);
      await pinWire(page);

      await page.keyboard.press("Control+k");
      await finder(page).waitFor();
      await page.keyboard.press("Escape");
      await finder(page).waitFor({ state: "detached" });
      expect(await page.getByTestId("relation-popover").count()).toBe(1);
      expect(await drawer(page).count()).toBe(1);

      await page.keyboard.press("Escape");
      await page.getByTestId("relation-popover").waitFor({ state: "detached" });
      expect(await drawer(page).count()).toBe(1);
    } finally {
      await close();
    }
  });
});

describe("searchable facet groups (TST-042, AC-048)", () => {
  it("shows the field only for the Domains group that needs more than three rows, never for Layers, narrows it, keeps chosen values and never changes the filters", async () => {
    const { page, close } = await openPage(many);
    try {
      await page.getByTestId("concept").first().waitFor();
      expect(await page.getByRole("searchbox").evaluateAll((all) => all.map((el) => el.getAttribute("aria-label")))).toEqual(["Search Domains"]);

      const chips = () => filters(page).getByRole("group", { name: "Domains" }).locator("button").allTextContents();
      expect(await chips()).toEqual(["All", ...DOMAINS]);
      const counted = await page.getByText("3 of 3 concepts shown").count();
      expect(counted).toBe(1);

      const search = page.getByRole("searchbox", { name: "Search Domains" });
      await search.fill("ING");
      expect(await chips()).toEqual(["All", "accounting", "billing", "invoicing", "messaging", "onboarding", "pricing", "reporting", "shipping"]);

      await search.fill("");
      await filters(page).getByRole("checkbox", { name: "identity", exact: true }).check();
      await page.getByText("1 of 3 concepts shown").waitFor();
      await search.fill("zzz");
      expect(await chips()).toEqual(["All", "identity"]);
      await page.getByText("1 of 3 concepts shown").waitFor();

      await search.fill("bill");
      expect(await chips()).toEqual(["All", "billing", "identity"]);
      expect(await filters(page).getByRole("checkbox", { name: "identity", exact: true }).getAttribute("aria-checked")).toBe("true");
      expect(await filters(page).getByRole("checkbox", { name: "billing", exact: true }).getAttribute("aria-checked")).toBe("false");
      await page.getByText("1 of 3 concepts shown").waitFor();
      await shot(page, "facet-search-light.png");

      await search.fill("");
      expect(await chips()).toEqual(["All", ...DOMAINS]);
      expect(await page.getByRole("searchbox", { name: "Search Domains" }).count()).toBe(1);
    } finally {
      await close();
    }
  });

  it("shows no field for the groups that fit in three rows", async () => {
    const { page, close } = await openPage(running);
    try {
      await concept(page, COMPACT).waitFor();
      expect(await page.getByRole("searchbox").count()).toBe(0);
    } finally {
      await close();
    }
  });

  it("is operable from the keyboard with a visible focus ring", async () => {
    const { page, close } = await openPage(many);
    try {
      await page.getByTestId("concept").first().waitFor();
      const search = page.getByRole("searchbox", { name: "Search Domains" });
      await search.focus();
      await page.keyboard.type("pay");
      expect(await filters(page).getByRole("group", { name: "Domains" }).locator("button").allTextContents()).toEqual(["All", "payments"]);
      expect(await search.evaluate((el) => getComputedStyle(el).outlineStyle !== "none" && Number.parseFloat(getComputedStyle(el).outlineWidth) >= 2)).toBe(true);
    } finally {
      await close();
    }
  });
});

// contrastFailures hides all text for its photograph, so each measurement needs a page of its own.
describe.each(["light", "dark"] as const)("focus and filter controls text contrast on rendered pixels, %s mode (R-7, AC-049)", (scheme) => {
  const fitSamples: Sample[] = [
    ["message", '[data-testid="fit-message"] p'],
    ["narrow", '[data-testid="fit-message"] button:nth-of-type(1)'],
    ["focus on a concept", '[data-testid="fit-message"] button:nth-of-type(2)'],
  ];

  it.each(["resting", "hovered"] as const)("keeps the fit message buttons at WCAG 2.2 AA, %s", async (state) => {
    const { page, close } = await openPage(wide, { scheme });
    try {
      await message(page).waitFor();
      if (state === "hovered") await page.getByRole("button", { name: "Narrow the filters" }).hover();
      await page.waitForTimeout(400);
      expect(await contrastFailures(page, fitSamples)).toEqual([]);
    } finally {
      await close();
    }
  });

  it.each(["resting", "hovered", "pressed with the pill"] as const)("keeps the Focus button at WCAG 2.2 AA, %s", async (state) => {
    const { page, close } = await openPage(running, { scheme });
    try {
      await concept(page, COMPACT).waitFor();
      await selectConcept(page, COMPACT);
      if (state === "hovered") await focusButton(page).hover();
      if (state === "pressed with the pill") {
        await focusButton(page).click();
        await pill(page).waitFor();
        await page.mouse.move(0, 0);
      }
      await page.waitForTimeout(700);
      if (state === "pressed with the pill") await shot(page, `focus-${scheme}.png`);
      const samples: Sample[] = [["focus button", '[data-testid="concept-detail"] .focus-btn']];
      if (state === "pressed with the pill") samples.push(["pill", '[data-testid="focus-pill"] p'], ["exit", '[data-testid="focus-pill"] button']);
      expect(await contrastFailures(page, samples)).toEqual([]);
    } finally {
      await close();
    }
  });

  it("keeps the search field text at WCAG 2.2 AA", async () => {
    const { page, close } = await openPage(many, { scheme });
    try {
      await page.getByTestId("concept").first().waitFor();
      await page.getByRole("searchbox", { name: "Search Domains" }).fill("ing");
      await page.waitForTimeout(300);
      expect(await contrastFailures(page, [["search", 'input[aria-label="Search Domains"]']])).toEqual([]);
    } finally {
      await close();
    }
  });
});
