import type { IncomingHttpHeaders } from "node:http";

export interface GuardVerdict {
  status: 403 | 415;
  message: string;
}

const hostNames = ["localhost", "127.0.0.1", "[::1]"];
const safeMethods = new Set(["GET", "HEAD"]);

export function checkRequest(req: { method?: string; headers: IncomingHttpHeaders }, port: number): GuardVerdict | null {
  const allowed = hostNames.map((name) => `${name}:${port}`);
  if (!allowed.includes(req.headers.host ?? "")) return { status: 403, message: "Host not allowed" };

  const origin = req.headers.origin;
  if (origin !== undefined) {
    if (!allowed.some((host) => origin === `http://${host}`)) return { status: 403, message: "Origin not allowed" };
  } else if (!safeMethods.has(req.method ?? "")) {
    return { status: 403, message: "Origin required" };
  }

  if (!safeMethods.has(req.method ?? "")) {
    const type = (req.headers["content-type"] ?? "").split(";")[0]?.trim().toLowerCase();
    if (type !== "application/json") return { status: 415, message: "Body must be application/json" };
  }
  return null;
}
