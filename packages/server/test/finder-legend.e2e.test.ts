import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { overWideConcepts, tst032Concepts } from "@arch-mind/rules/fixtures";
import { setupStore, writeConceptAtomic } from "@arch-mind/rules";
import { startServer, type RunningServer } from "../src/app.ts";

const uiDir = fileURLToPath(new URL("../../ui/dist", import.meta.url));
const shotDir = process.env.ARCH_MIND_SCREENSHOT_DIR;
const VIEWPORT = { width: 1366, height: 768 };

const byId = (id: string) => tst032Concepts.find((c) => c.id === id)!;
// Its neighbourhood sits on the client plate, so the selection fits the free area at Fit.
const COMPACT = "secure-attr";
const SERVER_CONCEPT = tst032Concepts.find((c) => c.layer === "server")!;
const LAST = tst032Concepts.at(-1)!;
const CODED = ["requires", "complements", "contains", "alternative to"];
const kindOf = (type: string) => (CODED.includes(type) ? type : "other");

let dir: string;
let running: RunningServer;
let wide: RunningServer;
let browser: Browser;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "arch-mind-finder-"));
  const store = await setupStore(join(dir, "store"), join(dir, "config.json"));
  for (const concept of tst032Concepts) await writeConceptAtomic(store, concept);
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

async function openPage(server: RunningServer, scheme: "light" | "dark" = "light", view: "Layers" | "Matrix" | "Refused" = "Layers") {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, colorScheme: scheme });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  await page.goto(`http://127.0.0.1:${server.port}/`);
  await page.getByTestId("board").waitFor();
  if (view === "Matrix") {
    await page.getByRole("button", { name: "Matrix" }).click();
    await page.locator("tbody tr").first().waitFor();
  } else if (view === "Refused") {
    await page.getByTestId("fit-message").waitFor();
  } else {
    await page.getByTestId("concept").first().waitFor();
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="wire"]').length > 0);
  }
  return { page, close: () => context.close() };
}

async function shot(page: Page, name: string) {
  if (!shotDir) return;
  await mkdir(shotDir, { recursive: true });
  await page.screenshot({ path: join(shotDir, name), animations: "disabled" });
}

const concept = (page: Page, id: string) => page.locator(`[data-testid="concept"][data-id="${id}"]`);
const drawer = (page: Page) => page.getByTestId("concept-detail");
const finder = (page: Page) => page.getByRole("dialog", { name: "Find a concept" });
const legendButton = (page: Page, name: string) => page.locator("section[aria-labelledby=wires-title]").getByRole("button", { name, exact: true });
const listboxChildRoles = (page: Page) => page.getByRole("listbox").evaluate((box) => [...box.children].map((c) => c.getAttribute("role")));
const popover = (page: Page) => page.getByTestId("relation-popover");

async function openFinder(page: Page, query = "") {
  await page.keyboard.press("Control+k");
  await finder(page).waitFor();
  if (query) await page.getByRole("combobox").fill(query);
}

async function chooseFirst(page: Page, query: string) {
  await openFinder(page, query);
  await page.keyboard.press("Enter");
  await finder(page).waitFor({ state: "detached" });
}

const wireStates = (page: Page) =>
  page.getByTestId("wire").evaluateAll((all) => all.map((w) => ({ type: w.getAttribute("aria-label")!.split(": ")[0]!, state: w.getAttribute("data-state") })));
const chipStates = (page: Page) => page.locator("[data-chip]").evaluateAll((all) => all.map((c) => c.getAttribute("data-state")));
const cellStates = (page: Page) => page.locator("tbody td").evaluateAll((all) => all.map((c) => c.getAttribute("data-state")));
const pressed = (page: Page) =>
  page.locator("section[aria-labelledby=wires-title] button").evaluateAll((all) => all.filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.getAttribute("aria-label")));

const allRelations = tst032Concepts.flatMap((c) => c.relations.map((r) => ({ from: c.id, to: r.to, kind: kindOf(r.type) })));
const touching = (id: string) => allRelations.filter((r) => r.from === id || r.to === id);

describe("finder (TST-037, AC-042)", () => {
  it("opens with Ctrl+K, filters by title or designator and chooses with the keyboard", async () => {
    const { page, close } = await openPage(running);
    try {
      expect(await finder(page).count()).toBe(0);
      await openFinder(page);
      expect(await page.getByRole("option").count()).toBe(tst032Concepts.length);
      expect(await page.getByRole("combobox").evaluate((el) => document.activeElement === el)).toBe(true);

      await page.getByRole("combobox").fill("S2");
      const first = page.getByRole("option").first();
      expect(await first.textContent()).toContain("S2");
      expect(await first.getAttribute("aria-selected")).toBe("true");
      expect(await page.getByRole("combobox").getAttribute("aria-activedescendant")).toBe(await first.getAttribute("id"));

      await page.getByRole("combobox").fill("certificate");
      const wanted = (await page.getByRole("option").first().getAttribute("data-id"))!;
      await page.keyboard.press("ArrowDown");
      expect(await page.getByRole("option").nth(1).getAttribute("aria-selected")).toBe("true");
      await page.keyboard.press("ArrowUp");
      expect(await page.getByRole("option").first().getAttribute("aria-selected")).toBe("true");
      await page.keyboard.press("Enter");
      await drawer(page).waitFor();
      expect(await finder(page).count()).toBe(0);
      await expect.poll(() => concept(page, wanted).getAttribute("data-state")).toBe("selected");
      await expect.poll(() => drawer(page).evaluate((el) => el.contains(document.activeElement))).toBe(true);
    } finally {
      await close();
    }
  });

  it("matches nothing from SEE-I text and says so", async () => {
    const { page, close } = await openPage(running);
    try {
      await openFinder(page, "controlled browser");
      expect(await page.getByRole("option").count()).toBe(0);
      expect(await page.getByText("No concept matches.").count()).toBe(1);
      expect(await listboxChildRoles(page)).toEqual([]);
      expect(await finder(page).getByRole("status").textContent()).toBe("No concept matches.");
      expect(await page.getByRole("listbox").getByRole("status").count()).toBe(0);
      await page.getByRole("combobox").fill("e");
      expect(new Set(await listboxChildRoles(page))).toEqual(new Set(["option"]));
      expect(await finder(page).getByRole("status").textContent()).toBe("");
    } finally {
      await close();
    }
  });

  it("returns focus to the element that had it when closed without a choice", async () => {
    const { page, close } = await openPage(running);
    try {
      await concept(page, COMPACT).focus();
      await openFinder(page);
      await page.keyboard.press("Escape");
      await finder(page).waitFor({ state: "detached" });
      expect(await concept(page, COMPACT).evaluate((el) => document.activeElement === el)).toBe(true);
    } finally {
      await close();
    }
  });

  it("closes on Escape without closing the open drawer or a pinned popover", async () => {
    const { page, close } = await openPage(running);
    try {
      await concept(page, COMPACT).click();
      await drawer(page).waitFor();
      const wire = page.getByTestId("wire").first();
      await wire.focus();
      await page.keyboard.press("Enter");
      await popover(page).waitFor();

      await openFinder(page);
      await page.keyboard.press("Escape");
      await finder(page).waitFor({ state: "detached" });
      expect(await drawer(page).count()).toBe(1);
      expect(await popover(page).count()).toBe(1);

      await page.keyboard.press("Escape");
      await popover(page).waitFor({ state: "detached" });
      await page.keyboard.press("Escape");
      await drawer(page).waitFor({ state: "detached" });
    } finally {
      await close();
    }
  });

  it("clears only the facets that hide the chosen concept and keeps the others", async () => {
    const { page, close } = await openPage(running);
    try {
      for (const name of ["client", "web", "security"]) await page.getByRole("checkbox", { name, exact: true }).check();
      await page.getByText(`${tst032Concepts.filter((c) => c.layer === "client").length} of 13 concepts shown`).waitFor();
      expect(await concept(page, SERVER_CONCEPT.id).count()).toBe(0);

      await chooseFirst(page, SERVER_CONCEPT.title);
      await drawer(page).waitFor();
      expect(await page.getByRole("checkbox", { name: "client", exact: true }).getAttribute("aria-checked")).toBe("false");
      expect(await page.getByRole("checkbox", { name: "web", exact: true }).getAttribute("aria-checked")).toBe("true");
      expect(await page.getByRole("checkbox", { name: "security", exact: true }).getAttribute("aria-checked")).toBe("true");
      await page.getByText("13 of 13 concepts shown").waitFor();
      await expect.poll(() => concept(page, SERVER_CONCEPT.id).getAttribute("data-state")).toBe("selected");
    } finally {
      await close();
    }
  });

  it("leaves the filters alone when the chosen concept is already shown, even if other filters hide others", async () => {
    const { page, close } = await openPage(running);
    try {
      await page.getByRole("checkbox", { name: "client", exact: true }).check();
      await chooseFirst(page, byId(COMPACT).title);
      await drawer(page).waitFor();
      expect(await page.getByRole("checkbox", { name: "client", exact: true }).getAttribute("aria-checked")).toBe("true");
    } finally {
      await close();
    }
  });

  it("shows the fit message and still opens the drawer when the cleared view would not fit", async () => {
    const { page, close } = await openPage(wide, "light", "Refused");
    try {
      await page.getByRole("checkbox", { name: "client", exact: true }).check();
      await page.getByRole("checkbox", { name: "web", exact: true }).check();
      await page.getByTestId("concept").first().waitFor();
      expect(await page.getByTestId("fit-message").count()).toBe(0);

      await openFinder(page, "Wide spoke 5");
      await page.keyboard.press("Enter");
      await drawer(page).waitFor();
      await page.getByTestId("fit-message").waitFor();
      expect(await page.getByRole("checkbox", { name: "client", exact: true }).getAttribute("aria-checked")).toBe("false");
      expect(await page.getByRole("checkbox", { name: "web", exact: true }).getAttribute("aria-checked")).toBe("true");
      expect(await drawer(page).getByRole("heading", { name: "Wide spoke 5" }).count()).toBe(1);
      await expect.poll(() => drawer(page).evaluate((el) => el.contains(document.activeElement))).toBe(true);
    } finally {
      await close();
    }
  });

  it("scrolls the chosen row into view in the matrix", async () => {
    const { page, close } = await openPage(running, "light", "Matrix");
    try {
      await chooseFirst(page, LAST.title);
      await drawer(page).waitFor();
      const row = page.locator("tbody tr", { has: page.locator("[aria-current=true]") });
      await row.waitFor();
      await expect
        .poll(async () => {
          const box = (await row.boundingBox())!;
          const legend = (await page.locator("section[aria-labelledby=wires-title]").boundingBox())!;
          return box.y >= 64 && box.y + box.height <= legend.y;
        })
        .toBe(true);
    } finally {
      await close();
    }
  });

  it("does nothing on Ctrl+K in Review", async () => {
    const { page, close } = await openPage(running);
    try {
      await page.getByRole("button", { name: "Review" }).click();
      await page.keyboard.press("Control+k");
      await page.waitForTimeout(150);
      expect(await finder(page).count()).toBe(0);
    } finally {
      await close();
    }
  });
});

describe("legend type toggles (TST-038, AC-043)", () => {
  it("makes a type active, switches, restores on a second press and on Escape, in the layer view", async () => {
    const { page, close } = await openPage(running);
    try {
      expect(new Set((await wireStates(page)).map((w) => w.state))).toEqual(new Set([null]));

      await legendButton(page, "requires").click();
      await expect.poll(() => pressed(page)).toEqual(["requires"]);
      const states = await wireStates(page);
      expect(states.filter((w) => w.state === "near").every((w) => kindOf(w.type) === "requires")).toBe(true);
      expect(states.filter((w) => w.state === "near")).toHaveLength(allRelations.filter((r) => r.kind === "requires").length);
      expect(states.filter((w) => w.state === "far")).toHaveLength(allRelations.filter((r) => r.kind !== "requires").length);
      expect((await chipStates(page)).filter((s) => s === "near")).toHaveLength(allRelations.filter((r) => r.kind === "requires").length);
      expect(await concept(page, COMPACT).getAttribute("data-state")).toBeNull();
      await shot(page, "legend-type-light.png");

      await legendButton(page, "any other type").click();
      await expect.poll(() => pressed(page)).toEqual(["any other type"]);
      expect((await wireStates(page)).filter((w) => w.state === "near")).toHaveLength(allRelations.filter((r) => r.kind === "other").length);

      await legendButton(page, "any other type").click();
      expect(await pressed(page)).toEqual([]);
      expect(new Set((await wireStates(page)).map((w) => w.state))).toEqual(new Set([null]));

      await legendButton(page, "contains").click();
      await expect.poll(() => pressed(page)).toEqual(["contains"]);
      await page.keyboard.press("Escape");
      await expect.poll(() => pressed(page)).toEqual([]);
      expect(new Set((await chipStates(page)).map((s) => s))).toEqual(new Set([null]));
    } finally {
      await close();
    }
  });

  it("keeps only wires in the neighbourhood and of the type when a concept is selected", async () => {
    const { page, close } = await openPage(running);
    try {
      await concept(page, COMPACT).click();
      await drawer(page).waitFor();
      const hood = touching(COMPACT);

      await legendButton(page, "requires").click();
      await expect.poll(async () => (await wireStates(page)).filter((w) => w.state === "near").length).toBe(hood.filter((r) => r.kind === "requires").length);
      expect((await wireStates(page)).filter((w) => w.state === "near").every((w) => kindOf(w.type) === "requires")).toBe(true);
      expect(await concept(page, COMPACT).getAttribute("data-state")).toBe("selected");
      await shot(page, "legend-type-selection-light.png");

      await legendButton(page, "any other type").click();
      await expect.poll(async () => (await wireStates(page)).filter((w) => w.state === "near").length).toBe(hood.filter((r) => r.kind === "other").length);

      await legendButton(page, "any other type").click();
      await expect.poll(async () => (await wireStates(page)).filter((w) => w.state === "near").length).toBe(hood.length);
    } finally {
      await close();
    }
  });

  it("closes the drawer on the first Escape and the active type on the second", async () => {
    const { page, close } = await openPage(running);
    try {
      await legendButton(page, "requires").click();
      await concept(page, COMPACT).click();
      await drawer(page).waitFor();
      await page.keyboard.press("Escape");
      await drawer(page).waitFor({ state: "detached" });
      expect(await pressed(page)).toEqual(["requires"]);
      await page.keyboard.press("Escape");
      await expect.poll(() => pressed(page)).toEqual([]);
    } finally {
      await close();
    }
  });

  it("applies the same rule to matrix cells, with and without a selection", async () => {
    const { page, close } = await openPage(running, "light", "Matrix");
    try {
      expect(new Set(await cellStates(page))).toEqual(new Set([null]));
      const pairs = (kind: string, id?: string) => new Set(allRelations.filter((r) => r.kind === kind && (!id || r.from === id || r.to === id)).map((r) => `${r.from}>${r.to}`)).size;

      await legendButton(page, "requires").click();
      await expect.poll(async () => (await cellStates(page)).filter((s) => s === "near").length).toBe(pairs("requires"));
      await shot(page, "legend-type-matrix-light.png");

      await page.locator("tbody th button", { hasText: byId(COMPACT).title }).first().click();
      await drawer(page).waitFor();
      await expect.poll(async () => (await cellStates(page)).filter((s) => s === "near").length).toBe(pairs("requires", COMPACT));

      await legendButton(page, "requires").click();
      // Without a type, every cell in the selected concept's row or column stays prominent, empty ones included.
      await expect.poll(async () => (await cellStates(page)).filter((s) => s === "near").length).toBe(2 * tst032Concepts.length - 1);
    } finally {
      await close();
    }
  });

  it("names every toggle by its type and keeps the line sample and letter code", async () => {
    const { page, close } = await openPage(running);
    try {
      const legend = page.locator("section[aria-labelledby=wires-title]");
      const buttons = legend.getByRole("button");
      expect(await buttons.evaluateAll((all) => all.map((b) => b.getAttribute("aria-label")))).toEqual(["requires", "complements", "contains", "alternative to", "any other type"]);
      expect(await legend.locator("svg line").count()).toBe(5);
      expect(await legend.textContent()).toMatch(/rq.*cp.*ct.*alt/);
    } finally {
      await close();
    }
  });
});

type Sample = [name: string, selector: string];

// Same rendered-pixel method as the drawer sweep: text is hidden, the page is photographed, and the ink colour is compared with the worst pixel under each text box.
async function contrastFailures(page: Page, samples: Sample[]) {
  const measured = await page.evaluate((selectors) => {
    const canvas = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
    const rgba = (css: string) => {
      canvas.clearRect(0, 0, 1, 1);
      canvas.fillStyle = "#000";
      canvas.fillStyle = css;
      canvas.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = canvas.getImageData(0, 0, 1, 1).data;
      return { rgb: [r!, g!, b!], alpha: a! / 255 };
    };
    return selectors.map(([name, selector]) => {
      const el = document.querySelector(selector);
      if (el instanceof HTMLInputElement) {
        const r = el.getBoundingClientRect();
        return { name, color: rgba(getComputedStyle(el).color), box: { x: r.x + 18, y: r.y, width: r.width - 36, height: r.height } };
      }
      const walker = el && document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let text: Text | null = null;
      for (let node = walker?.nextNode(); node && !text; node = walker!.nextNode()) {
        if (node.textContent?.trim() && !node.parentElement!.closest(".sr-only")) text = node as Text;
      }
      const range = document.createRange();
      if (text) range.selectNodeContents(text);
      const box = text ? range.getBoundingClientRect() : null;
      return { name, color: el ? rgba(getComputedStyle(text!.parentElement!).color) : null, box: box ? { x: box.x, y: box.y, width: box.width, height: box.height } : null };
    });
  }, samples);

  await page.addStyleTag({ content: "* { color: transparent !important; text-shadow: none !important; caret-color: transparent !important; }" });
  const png = (await page.screenshot()).toString("base64");
  const ratios = await page.evaluate(
    async ({ png, measured }) => {
      const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${png}`)).blob());
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(bitmap, 0, 0);
      const lum = (c: number[]) => {
        const [r, g, b] = c.map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
        return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
      };
      return measured.map(({ name, color, box }) => {
        if (!color || !box) return [name, 0, "missing"] as const;
        const { data } = ctx.getImageData(Math.ceil(box.x), Math.floor(box.y + box.height / 2 - 2), Math.max(1, Math.floor(box.width)), 4);
        let worst = Infinity;
        for (let i = 0; i < data.length; i += 4) {
          const bg = [data[i]!, data[i + 1]!, data[i + 2]!];
          const fg = color.rgb.map((v, k) => v * color.alpha + bg[k]! * (1 - color.alpha));
          const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a);
          worst = Math.min(worst, (hi! + 0.05) / (lo! + 0.05));
        }
        return [name, worst, JSON.stringify(color)] as const;
      });
    },
    { png, measured },
  );
  return ratios.filter(([, value]) => value < 4.5).map(([name, value, c]) => `${name} ${value.toFixed(2)} ${c}`);
}

describe.each(["light", "dark"] as const)("finder and legend text contrast on rendered pixels, %s mode (AC-044)", (scheme) => {
  it("keeps the finder text at WCAG 2.2 AA for the active and the other matches", async () => {
    const { page, close } = await openPage(running, scheme);
    try {
      await openFinder(page, "e");
      await page.waitForTimeout(500);
      await shot(page, `finder-open-${scheme}.png`);
      const active = '[role="option"][aria-selected="true"]';
      const idle = '[role="option"][aria-selected="false"]';
      const failures = await contrastFailures(page, [
        ["input", '[role="combobox"]'],
        ["active designator", `${active} .des`],
        ["active title", `${active} .ttl`],
        ["active layer", `${active} .muted`],
        ["idle designator", `${idle} .des`],
        ["idle title", `${idle} .ttl`],
        ["idle layer", `${idle} .muted`],
      ]);
      expect(failures).toEqual([]);
    } finally {
      await close();
    }
  });

  it("keeps the legend toggle text at WCAG 2.2 AA with no type and with one active", async () => {
    const { page, close } = await openPage(running, scheme);
    try {
      const legend = "section[aria-labelledby=wires-title]";
      const sample = (i: number): Sample[] => [
        [`code ${i}`, `${legend} button:nth-of-type(${i}) span:nth-of-type(1)`],
        [`type ${i}`, `${legend} button:nth-of-type(${i}) span:last-of-type`],
      ];
      const rows = [1, 2, 3, 4, 5].flatMap(sample).filter(([name]) => name !== "code 5");
      expect(await contrastFailures(page, rows)).toEqual([]);

      await page.reload();
      await page.getByTestId("concept").first().waitFor();
      await legendButton(page, "requires").click();
      await concept(page, COMPACT).click();
      await drawer(page).waitFor();
      await page.waitForTimeout(600);
      await shot(page, `legend-type-selection-${scheme}.png`);
      expect(await contrastFailures(page, [...rows, ["heading", `${legend} h2`]])).toEqual([]);
    } finally {
      await close();
    }
  });

  it("keeps every legend entry at WCAG 2.2 AA when resting, hovered, pressed and pressed under the pointer", async () => {
    const { page, close } = await openPage(running, scheme);
    try {
      const legend = "section[aria-labelledby=wires-title]";
      const names = ["requires", "complements", "contains", "alternative to", "any other type"];
      const failures: string[] = [];
      for (const [i, name] of names.entries()) {
        const n = i + 1;
        const samples: Sample[] = [[`type ${name}`, `${legend} button:nth-of-type(${n}) span:last-of-type`]];
        if (n < 5) samples.push([`code ${name}`, `${legend} button:nth-of-type(${n}) span:nth-of-type(1)`]);
        for (const state of ["hovered", "pressed", "pressed and hovered"]) {
          await page.reload();
          await page.getByTestId("concept").first().waitFor();
          if (state !== "hovered") await legendButton(page, name).click();
          if (state === "pressed") await page.mouse.move(0, 0);
          else await legendButton(page, name).hover();
          await page.waitForTimeout(400);
          failures.push(...(await contrastFailures(page, samples)).map((f) => `${state}: ${f}`));
        }
      }
      expect(failures).toEqual([]);
    } finally {
      await close();
    }
  });

  it("captures the legend with a type active and no selection", async () => {
    const { page, close } = await openPage(running, scheme);
    try {
      await legendButton(page, "requires").click();
      await page.waitForTimeout(600);
      await shot(page, `legend-type-${scheme}.png`);
    } finally {
      await close();
    }
  });
});
