import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startServer, type RunningServer } from "../src/app.ts";

let dir: string;
let running: RunningServer;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "arch-mind-guard-"));
  await mkdir(join(dir, "concepts"), { recursive: true });
  await writeFile(join(dir, "facets.yaml"), "domains: [web]\nconcerns: [security]\nleitnerIntervalsDays: [1]\n");
  await mkdir(join(dir, "ui"));
  await writeFile(join(dir, "ui", "index.html"), "<html>ok</html>");
  running = await startServer({ storePath: dir, uiDir: join(dir, "ui"), port: 0 });
});

afterAll(async () => {
  await running.close();
  await rm(dir, { recursive: true, force: true });
});

function send(opts: { method?: string; path?: string; host?: string; headers?: Record<string, string>; body?: string }) {
  return new Promise<{ status: number; headers: Record<string, unknown>; text: string }>((resolve, reject) => {
    const req = request(
      {
        host: "127.0.0.1",
        port: running.port,
        method: opts.method ?? "GET",
        path: opts.path ?? "/api/concepts",
        headers: { Host: opts.host ?? `127.0.0.1:${running.port}`, ...opts.headers },
      },
      (res) => {
        let text = "";
        res.on("data", (c) => (text += c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, text }));
      },
    );
    req.on("error", reject);
    req.end(opts.body);
  });
}

describe("request guard (TST-007, AC-9)", () => {
  it("serves GET /api/concepts and /api/facets for each accepted host name", async () => {
    for (const name of ["localhost", "127.0.0.1", "[::1]"]) {
      const res = await send({ host: `${name}:${running.port}` });
      expect(res.status, name).toBe(200);
    }
    const facets = await send({ path: "/api/facets" });
    expect(JSON.parse(facets.text)).toEqual({
      layers: ["client", "network", "server", "data"],
      domains: ["web"],
      concerns: ["security"],
    });
  });

  it("answers 403 to a foreign Host, including a right host on the wrong port", async () => {
    expect((await send({ host: "evil.example" })).status).toBe(403);
    expect((await send({ host: `evil.example:${running.port}` })).status).toBe(403);
    expect((await send({ host: `localhost:${running.port + 1}` })).status).toBe(403);
  });

  it("answers 403 to a foreign Origin on any method", async () => {
    const origin = { Origin: "http://evil.example" };
    expect((await send({ headers: origin })).status).toBe(403);
    expect((await send({ method: "POST", path: "/api/reviews", headers: { ...origin, "Content-Type": "application/json" }, body: "{}" })).status).toBe(403);
  });

  it("accepts the app's own origin and a request without Origin only for GET and HEAD", async () => {
    expect((await send({ headers: { Origin: `http://127.0.0.1:${running.port}` } })).status).toBe(200);
    expect((await send({ method: "HEAD" })).status).toBe(200);
    expect((await send({ method: "POST", path: "/api/reviews", headers: { "Content-Type": "application/json" }, body: "{}" })).status).toBe(403);
  });

  it("answers 415 to a body that is not application/json", async () => {
    const res = await send({
      method: "POST",
      path: "/api/reviews",
      headers: { Origin: `http://127.0.0.1:${running.port}`, "Content-Type": "text/plain" },
      body: "x",
    });
    expect(res.status).toBe(415);
  });

  it("sends no CORS headers", async () => {
    const res = await send({ headers: { Origin: `http://127.0.0.1:${running.port}` } });
    expect(Object.keys(res.headers).filter((h) => h.startsWith("access-control-"))).toEqual([]);
  });

  it("binds 127.0.0.1 only", () => {
    expect(running.server.address()).toMatchObject({ address: "127.0.0.1" });
  });

  it("has no write endpoint for concepts (TST-006)", async () => {
    const res = await send({
      method: "POST",
      path: "/api/concepts",
      headers: { Origin: `http://127.0.0.1:${running.port}`, "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(405);
  });

  it("serves the UI index for other paths", async () => {
    const res = await send({ path: "/" });
    expect(res.text).toContain("ok");
  });

  it("does not serve files outside the UI folder", async () => {
    await writeFile(join(dir, "secret.txt"), "top secret");
    const res = await send({ path: "/..%2fsecret.txt" });
    expect(res.text).not.toContain("top secret");
  });
});
