import type { FastifyInstance } from "fastify";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "../mcp/server.js";
import { ContextCache } from "../mcp/context-cache.js";
import type { MemoryStore } from "../storage.js";

export function registerMcpRoutes(app: FastifyInstance, store: MemoryStore, internalMcpToken: string, contextCache: ContextCache) {
  app.all("/mcp", async (request, reply) => reply.redirect("/mcp/", 307));
  app.all("/mcp/", async (request, reply) => {
    const internal = request.headers["x-memory-one-internal"] === internalMcpToken;
    const authRequired = store.getMcpConfig().use_bearer_key;
    const authorization = request.headers.authorization;
    const secret = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
    const key = authRequired && secret ? store.verifyMcpKey(secret) : null;
    if (!internal && authRequired && (!secret || !key)) return reply.code(401).header("www-authenticate", "Bearer").send({ error: secret ? "invalid_mcp_key" : "mcp_key_required" });
    const allowedTools = key && key.allowed_tools.length ? new Set(key.allowed_tools) : undefined;
    const cacheIdentity = key?.id ?? "internal";
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    const mcp = createMcpServer(store, allowedTools, contextCache, cacheIdentity);
    await mcp.connect(transport);
    await transport.handleRequest(request.raw, reply.raw, request.body);
    reply.hijack();
  });
}
