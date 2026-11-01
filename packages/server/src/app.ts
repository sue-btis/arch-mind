import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, normalize, sep } from "node:path";
import { LAYERS, loadConceptDetail, loadConcepts, loadFacets } from "@arch-mind/rules";
import { checkRequest } from "./guard.ts";

export interface RunningServer {
  server: Server;
  port: number;
  close(): Promise<void>;
}

const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

async function sendStatic(res: ServerResponse, uiDir: string, urlPath: string) {
  const relative = normalize(decodeURIComponent(urlPath)).replace(/^[\\/]+/, "");
  let file = join(uiDir, relative || "index.html");
  if (file !== uiDir && !file.startsWith(uiDir + sep)) file = join(uiDir, "index.html");
  const bytes = await readFile(file).catch(() => null);
  const body = bytes ?? (await readFile(join(uiDir, "index.html")).catch(() => null));
  if (!body) return sendJson(res, 404, { error: "UI build not found" });
  const type = bytes ? (contentTypes[extname(file)] ?? "application/octet-stream") : contentTypes[".html"];
  res.writeHead(200, { "Content-Type": type });
  res.end(body);
}

export async function startServer(options: { storePath: string; uiDir: string; port: number }): Promise<RunningServer> {
  const { storePath, uiDir } = options;
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const port = (server.address() as AddressInfo).port;
    const verdict = checkRequest(req, port);
    if (verdict) return sendJson(res, verdict.status, { error: verdict.message });

    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    const readOnly = req.method === "GET" || req.method === "HEAD";
    try {
      if (path === "/api/concepts" || path === "/api/facets") {
        if (!readOnly) return sendJson(res, 405, { error: "Method not allowed" });
        if (path === "/api/concepts") return sendJson(res, 200, await loadConcepts(storePath));
        const { domains, concerns } = await loadFacets(storePath);
        return sendJson(res, 200, { layers: LAYERS, domains, concerns });
      }
      const detailId = /^\/api\/concepts\/([^/]+)$/.exec(path)?.[1];
      if (detailId !== undefined) {
        if (!readOnly) return sendJson(res, 405, { error: "Method not allowed" });
        const detail = await loadConceptDetail(storePath, detailId);
        if (!detail.ok) return sendJson(res, 404, { error: detail.errors[0]!.message });
        return sendJson(res, 200, { concept: detail.concept, questions: detail.questions });
      }
      if (path.startsWith("/api/")) return sendJson(res, 404, { error: "Not found" });
      if (!readOnly) return sendJson(res, 405, { error: "Method not allowed" });
      await sendStatic(res, uiDir, path);
    } catch (error) {
      sendJson(res, 500, { error: (error as Error).message });
    }
  });

  const attempts = options.port === 0 ? 1 : 20;
  for (let i = 0; i < attempts; i++) {
    const port = options.port + i;
    try {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, "127.0.0.1", () => {
          server.off("error", reject);
          resolve();
        });
      });
      return {
        server,
        port: (server.address() as AddressInfo).port,
        close: () => new Promise((resolve) => server.close(() => resolve())),
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EADDRINUSE" || i === attempts - 1) throw error;
    }
  }
  throw new Error("unreachable");
}
