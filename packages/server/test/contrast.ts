import type { Page } from "playwright-core";

export type Sample = [name: string, selector: string];

// Same rendered-pixel method as the finder and drawer sweeps: text is hidden, the page is photographed, and the ink colour is compared with the worst pixel under each text box.
export async function contrastFailures(page: Page, samples: Sample[]) {
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
