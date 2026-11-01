import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDays, localDate, setupStore, writeConceptAtomic, type Concept } from "@arch-mind/rules";
import { tst032Concepts } from "@arch-mind/rules/fixtures";
import { startServer, type RunningServer } from "../src/app.ts";
import { writeLoadStore } from "./load-store.ts";

const uiDir = fileURLToPath(new URL("../../ui/dist", import.meta.url));
const shotDir = process.env.ARCH_MIND_SCREENSHOT_DIR;
const VIEWPORT = { width: 1366, height: 768 };
const today = localDate();

const dueConcepts: Concept[] = tst032Concepts
  .map((c) => ({ ...c, recall: c.recall.map((q) => ({ ...q, confirmed: addDays(today, -1) })) }))
  .sort((a, b) => (a.id < b.id ? -1 : 1));
const alreadyReviewed = dueConcepts.at(-1)!;

let dir: string;
let browser: Browser;
const closers: (() => Promise<void>)[] = [];

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "arch-mind-review-e2e-"));
  browser = await chromium.launch({ channel: "chrome" });
});

afterAll(async () => {
  await browser?.close();
  for (const close of closers) await close();
  await rm(dir, { recursive: true, force: true });
});

async function freshStore(name: string, concepts: Concept[], lines: string[] = []) {
  const store = await setupStore(join(dir, name), join(dir, `${name}.json`));
  for (const concept of concepts) await writeConceptAtomic(store, concept);
  await writeFile(join(store, "reviews.jsonl"), lines.map((l) => `${l}\n`).join(""));
  const server = await startServer({ storePath: store, uiDir, port: 0 });
  closers.push(() => server.close());
  return { store, server };
}

async function openPage(server: RunningServer, scheme: "light" | "dark" = "light"): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, colorScheme: scheme });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${server.port}/`);
  await page.waitForSelector('[data-testid="board"]');
  return { page, close: () => context.close() };
}

const documentText = (page: Page) => page.evaluate(() => document.body.textContent ?? "");
const horizontalOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

async function shot(page: Page, name: string, scheme: string) {
  if (!shotDir) return;
  await mkdir(shotDir, { recursive: true });
  await page.screenshot({ path: join(shotDir, `${name}-1366x768-${scheme}.png`), animations: "disabled" });
}

describe.each(["light", "dark"] as const)("daily review at 1366 x 768, %s mode (TST-020, AC-5, AC-6)", (scheme) => {
  it("hides the answer until revealed, records a wrong and a right answer as two appended lines, and offers the detail after a wrong one", async () => {
    const existing = JSON.stringify({ question: `${alreadyReviewed.id}#q1`, at: new Date().toISOString(), result: "right" });
    const { store, server } = await freshStore(`flow-${scheme}`, dueConcepts, [existing]);
    const before = await readFile(join(store, "reviews.jsonl"));
    const { page, close } = await openPage(server, scheme);
    try {
      await page.getByRole("button", { name: "Review", exact: true }).click();
      await page.getByTestId("review-question").waitFor();
      expect(await page.getByTestId("due-count").textContent()).toBe(`${dueConcepts.length - 1} questions due`);

      const first = dueConcepts[0]!;
      const second = dueConcepts[1]!;
      expect(await page.getByRole("heading", { name: first.recall[0]!.question }).count()).toBe(1);
      let text = await documentText(page);
      for (const part of Object.values(first.seeI)) expect(text).not.toContain(part);
      for (const r of first.relations) expect(text).not.toContain(r.explanation);
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
      await shot(page, "review-question", scheme);

      await page.getByRole("button", { name: "Show answer" }).click();
      const answer = page.getByTestId("review-answer");
      await answer.waitFor();
      text = (await answer.textContent()) ?? "";
      for (const part of Object.values(first.seeI)) expect(text).toContain(part);
      for (const r of first.relations) expect(text).toContain(r.explanation);
      expect(await page.evaluate(() => document.activeElement?.textContent)).toBe("Right");
      await shot(page, "review-answer", scheme);

      await page.getByRole("button", { name: "Wrong" }).click();
      const result = page.getByTestId("review-result");
      await result.getByText(`Marked wrong. Box 1 · due ${addDays(today, 1)}`).waitFor();
      await shot(page, "review-wrong", scheme);

      await result.getByRole("button", { name: "Open concept" }).click();
      const dialog = page.getByRole("dialog", { name: first.title });
      await dialog.waitFor();
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "detached" });
      expect(await page.evaluate(() => document.activeElement?.textContent)).toBe("Open concept");

      await page.getByRole("button", { name: "Next" }).click();
      await page.getByRole("heading", { name: second.recall[0]!.question }).waitFor();
      expect(await page.evaluate(() => document.activeElement?.textContent)).toBe(second.recall[0]!.question);
      expect(await page.getByTestId("review-answer").count()).toBe(0);

      await page.keyboard.press("Tab");
      const ring = await page.evaluate(() => {
        const style = getComputedStyle(document.activeElement!);
        return { name: document.activeElement!.textContent, style: style.outlineStyle, width: style.outlineWidth };
      });
      expect(ring).toEqual({ name: "Show answer", style: "solid", width: "2px" });
      await page.keyboard.press("Enter");
      await page.getByTestId("review-answer").waitFor();
      await page.keyboard.press("Enter");
      await page.getByTestId("review-result").getByText(`Marked right. Box 2 · due ${addDays(today, 3)}`).waitFor();

      const after = await readFile(join(store, "reviews.jsonl"));
      expect(after.subarray(0, before.length).equals(before)).toBe(true);
      const added = after.subarray(before.length).toString().trim().split("\n").map((l) => JSON.parse(l));
      expect(added).toEqual([
        expect.objectContaining({ question: `${first.id}#q1`, result: "wrong" }),
        expect.objectContaining({ question: `${second.id}#q1`, result: "right" }),
      ]);
    } finally {
      await close();
    }
  });
});

describe("review screen states", () => {
  it("says so when nothing is due", async () => {
    const quiet = { ...dueConcepts[0]!, recall: [{ id: "q1", question: "Later?", confirmed: today }] };
    const { server } = await freshStore("quiet", [quiet]);
    const { page, close } = await openPage(server);
    try {
      await page.getByRole("button", { name: "Review", exact: true }).click();
      await page.getByText("Nothing is due today.").waitFor();
      expect(await page.getByRole("button", { name: "Show answer" }).count()).toBe(0);
    } finally {
      await close();
    }
  });

  it("ends with a caught-up message after the last question", async () => {
    const one = { ...dueConcepts[0]!, recall: [{ id: "q1", question: "Only one?", confirmed: addDays(today, -1) }] };
    const { server } = await freshStore("single", [one]);
    const { page, close } = await openPage(server);
    try {
      await page.getByRole("button", { name: "Review", exact: true }).click();
      await page.getByRole("button", { name: "Show answer" }).click();
      await page.getByRole("button", { name: "Right" }).click();
      await page.getByRole("button", { name: "Next" }).click();
      await page.getByTestId("review-done").waitFor();
      expect(await page.getByTestId("review-done").textContent()).toBe("All caught up: 1 reviewed.");
    } finally {
      await close();
    }
  });
});

describe("TST-019: the due list appears within 2 s under load (NFR-006)", () => {
  it("shows the first due question within 2 s of navigation with 300 concepts, 600 questions and a year of reviews", async () => {
    const store = await setupStore(join(dir, "load"), join(dir, "load.json"));
    await writeLoadStore(store, today);
    const server = await startServer({ storePath: store, uiDir, port: 0 });
    closers.push(() => server.close());
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
    const page = await context.newPage();
    try {
      const started = performance.now();
      await page.goto(`http://127.0.0.1:${server.port}/`);
      await page.getByRole("button", { name: "Review", exact: true }).click();
      await page.getByTestId("review-question").waitFor();
      const elapsed = performance.now() - started;
      const count = (await page.getByTestId("due-count").textContent()) ?? "";
      process.stdout.write(`TST-019 Chrome 1366x768: navigation to visible due list ${elapsed.toFixed(0)} ms (${count})\n`);
      expect(elapsed).toBeLessThanOrEqual(2000);
    } finally {
      await context.close();
    }
  });
});
