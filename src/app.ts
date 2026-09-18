import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { MemoryStore } from "./storage.js";
import { ContextCache } from "./mcp/context-cache.js";
import { createClaudeIntegrationService } from "./integrations/claude.js";
import { createCodexIntegrationService } from "./integrations/codex.js";
import { registerMemoryRoutes } from "./routes/memories.js";
import { registerDataRoutes } from "./routes/data.js";
import { registerSettingsRoutes } from "./routes/settings.js";
import { registerIntegrationRoutes } from "./routes/integrations.js";
import { registerAgentRoutes } from "./routes/agent.js";
import { registerMcpRoutes } from "./routes/mcp.js";
import { packageVersion, registerSystemRoutes } from "./routes/system.js";

export function createApp(options: { dbPath?: string } = {}) {
  const store = new MemoryStore(options.dbPath ?? process.env.MEMORY_DB_PATH ?? "data/memory.db");
  const internalMcpToken = randomUUID();
  const contextCache = new ContextCache();
  const app = Fastify({ logger: true });
  const connectMemoryMcp = async () => {
    const client = new Client({ name: "memory-one-agent", version: "0.1.0" });
    const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${process.env.MEMORY_PORT ?? 8765}/mcp`), { requestInit: { headers: { "x-memory-one-internal": internalMcpToken } } });
    await client.connect(transport);
    return { client, transport };
  };
  const codex = createCodexIntegrationService(store);
  const claude = createClaudeIntegrationService(store);

  registerSystemRoutes(app, packageVersion);
  registerMemoryRoutes(app, store);
  registerDataRoutes(app, store);
  registerSettingsRoutes(app, store);
  registerIntegrationRoutes(app, codex, claude);
  registerAgentRoutes(app, store, connectMemoryMcp as any);
  registerMcpRoutes(app, store, internalMcpToken, contextCache);
  return { app, store };
}
