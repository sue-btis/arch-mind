// Throwaway probe: minimal stdio MCP server (newline-delimited JSON-RPC, no SDK)
// that saves one concept as a Markdown file with YAML frontmatter.
import { createInterface } from "node:readline";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = process.argv[2] ?? join(import.meta.dirname, "data");
const LAYERS = ["client", "network", "server", "data"];

const addConceptSchema = {
  type: "object",
  required: ["id", "title", "layer", "relations", "recall"],
  properties: {
    id: { type: "string", pattern: "^[a-z0-9-]+$" },
    title: { type: "string" },
    layer: { enum: LAYERS },
    domains: { type: "array", items: { type: "string" } },
    relations: {
      type: "array",
      items: {
        type: "object",
        required: ["type", "to", "source"],
        properties: { type: { type: "string" }, to: { type: "string" }, source: { type: "string" } },
      },
    },
    episode: { type: "string" },
    recall: { type: "array", items: { type: "string" }, minItems: 1 },
    body: { type: "string" },
  },
};

// The client may skip schema validation, so the server enforces the musts itself.
function validate(c) {
  const errors = [];
  if (!/^[a-z0-9-]+$/.test(c.id ?? "")) errors.push("id must be a lowercase slug");
  if (!c.title) errors.push("title is required");
  if (!LAYERS.includes(c.layer)) errors.push(`layer must be one of ${LAYERS.join(", ")}`);
  if (!Array.isArray(c.recall) || c.recall.length === 0) errors.push("at least one recall question is required");
  for (const [i, r] of (c.relations ?? []).entries())
    if (!r.type || !r.to || !r.source) errors.push(`relation ${i} needs type, to and source`);
  return errors;
}

// JSON strings are valid YAML scalars, which avoids hand-rolled YAML escaping.
const q = JSON.stringify;
function toMarkdown(c) {
  const lines = ["---", `id: ${q(c.id)}`, `title: ${q(c.title)}`, `layer: ${q(c.layer)}`,
    `domains: ${q(c.domains ?? [])}`, "relations:"];
  for (const r of c.relations) lines.push(`  - { type: ${q(r.type)}, to: ${q(r.to)}, source: ${q(r.source)} }`);
  if (c.episode) lines.push(`episode: ${q(c.episode)}`);
  lines.push("recall:", ...c.recall.map(x => `  - ${q(x)}`), "---", "", c.body ?? "", "");
  return lines.join("\n");
}

function addConcept(args) {
  const errors = validate(args);
  if (errors.length) return { isError: true, content: [{ type: "text", text: errors.join("; ") }] };
  mkdirSync(DATA_DIR, { recursive: true });
  const file = join(DATA_DIR, `${args.id}.md`);
  if (existsSync(file)) return { isError: true, content: [{ type: "text", text: `${args.id} already exists` }] };
  writeFileSync(file, toMarkdown(args), { flag: "wx" });
  return { content: [{ type: "text", text: `saved ${file}` }] };
}

function handle(msg) {
  switch (msg.method) {
    case "initialize":
      return { protocolVersion: "2025-06-18", capabilities: { tools: {} },
               serverInfo: { name: "arch-mind-probe", version: "0.0.0" } };
    case "tools/list":
      return { tools: [{ name: "add_concept", description: "Save one architecture concept to the arch-mind store",
                         inputSchema: addConceptSchema }] };
    case "tools/call":
      if (msg.params?.name !== "add_concept") throw { code: -32602, message: "unknown tool" };
      return addConcept(msg.params.arguments ?? {});
    default:
      throw { code: -32601, message: `method not found: ${msg.method}` };
  }
}

createInterface({ input: process.stdin }).on("line", line => {
  if (!line.trim()) return;
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  if (msg.id === undefined) return;
  let reply;
  try { reply = { jsonrpc: "2.0", id: msg.id, result: handle(msg) }; }
  catch (e) { reply = { jsonrpc: "2.0", id: msg.id, error: { code: e.code ?? -32603, message: e.message ?? String(e) } }; }
  process.stdout.write(JSON.stringify(reply) + "\n");
});
