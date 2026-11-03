import { spawn } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type OpenPage = (file: string) => Promise<void>;

// Detached and unreferenced so the browser outlives the tool call; a missing opener is not an error because the page path is returned either way.
export const openInDefaultBrowser: OpenPage = async (file) => {
  const [command, args] =
    process.platform === "win32"
      ? ["rundll32", ["url.dll,FileProtocolHandler", file]]
      : process.platform === "darwin"
        ? ["open", [file]]
        : ["xdg-open", [file]];
  const child = spawn(command!, args as string[], { detached: true, stdio: "ignore", windowsHide: true });
  child.on("error", () => {});
  child.unref();
};

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// The SVG is only ever referenced from an <img>, never inlined, so a script inside it cannot run even if the validator missed it.
export async function writePreview(id: string, svg: string, tempRoot: string = tmpdir()): Promise<string> {
  const dir = await mkdtemp(join(tempRoot, "arch-mind-preview-"));
  const page = join(dir, "preview.html");
  await writeFile(join(dir, "illustration.svg"), svg, "utf8");
  await writeFile(
    page,
    `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Illustration preview: ${escapeHtml(id)}</title>
<style>body{margin:0;padding:32px;font:16px system-ui,sans-serif;background:#f4f4f5;color:#18181b}img{display:block;max-width:min(100%,720px);max-height:70vh;background:#fff;border:1px solid #d4d4d8;border-radius:12px}p{max-width:60ch}</style>
</head>
<body>
<h1>${escapeHtml(id)}</h1>
<p>This is only a preview. Nothing is saved until you accept it in Claude Code.</p>
<img src="illustration.svg" alt="Proposed illustration for ${escapeHtml(id)}">
</body>
</html>
`,
    "utf8",
  );
  return page;
}
