// Drives server.mjs over stdio the way an MCP client would and asserts the musts.
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

const dataDir = mkdtempSync(join(tmpdir(), "arch-mind-probe-"));
const server = spawn(process.execPath, [join(import.meta.dirname, "server.mjs"), dataDir]);
const pending = new Map();
let buf = "";
server.stdout.on("data", d => {
  buf += d;
  for (let i; (i = buf.indexOf("\n")) >= 0; buf = buf.slice(i + 1)) {
    const msg = JSON.parse(buf.slice(0, i));
    pending.get(msg.id)?.(msg);
  }
});
let nextId = 1;
const call = (method, params) => new Promise(res => {
  const id = nextId++;
  pending.set(id, res);
  server.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
});

const concept = {
  id: "secure-attr", title: "Secure cookie attribute", layer: "client", domains: ["web"],
  relations: [{ type: "needs", to: "secure-context", source: "draft-ietf-httpbis-rfc6265bis" }],
  episode: "TST-032",
  recall: ["Why did WebKit drop the session cookie over http://*.localhost while Chromium kept it?"],
  body: "A cookie with `Secure` is only sent over secure transport.",
};

const init = await call("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "check", version: "0" } });
assert.equal(init.result.serverInfo.name, "arch-mind-probe");
const list = await call("tools/list", {});
assert.deepEqual(list.result.tools.map(t => t.name), ["add_concept"]);

const t0 = performance.now();
const ok = await call("tools/call", { name: "add_concept", arguments: concept });
const ms = performance.now() - t0;
assert.equal(ok.result.isError, undefined);
const md = readFileSync(join(dataDir, "secure-attr.md"), "utf8");
assert.match(md, /source: "draft-ietf-httpbis-rfc6265bis"/);

const noSource = await call("tools/call", { name: "add_concept",
  arguments: { ...concept, id: "no-source", relations: [{ type: "needs", to: "x" }] } });
assert.equal(noSource.result.isError, true);
assert.match(noSource.result.content[0].text, /needs type, to and source/);

const dup = await call("tools/call", { name: "add_concept", arguments: concept });
assert.equal(dup.result.isError, true);

server.kill();
console.log(`ok: saved in ${ms.toFixed(1)} ms; rejected relation without source; rejected duplicate\n--- ${dataDir}\n${md}`);
