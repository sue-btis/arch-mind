import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { StoreError, loadConfig, loadFacets } from "@arch-mind/rules";
import { runTool, toolDefinitions } from "./tools.ts";

async function main() {
  const { storePath } = await loadConfig();
  await loadFacets(storePath);

  const server = new Server({ name: "arch-mind-capture", version: "0.1.0" }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [...toolDefinitions] }));
  server.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
    let outcome;
    try {
      outcome = await runTool(storePath, params.name, params.arguments);
    } catch (error) {
      if (error instanceof StoreError) throw new McpError(ErrorCode.InternalError, error.message);
      throw error;
    }
    if (!outcome) throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${params.name}`);
    return {
      isError: outcome.isError,
      structuredContent: outcome.structured,
      content: [{ type: "text", text: JSON.stringify(outcome.structured) }],
    };
  });
  await server.connect(new StdioServerTransport());
}

// stdout carries the protocol, so diagnostics go to stderr.
main().catch((error) => {
  console.error(error instanceof StoreError ? error.message : error);
  process.exit(1);
});
