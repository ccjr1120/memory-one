import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { MemoryStore, type MemoryInput } from "./storage.js";

const store = new MemoryStore();
const json = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }] });
const storageScope = "user";
const exposeMemory = (memory: any) => { if (!memory || typeof memory !== "object" || "error" in memory) return memory; const { project, ...rest } = memory; return { ...rest, scope: project ?? "global" }; };
const exposeMemories = (memories: any[]) => memories.map(exposeMemory);
const toStorageInput = (input: Record<string, unknown>) => { const { scope, ...rest } = input; return { ...rest, scope: storageScope, project: typeof scope === "string" && scope !== "global" ? scope : null } as MemoryInput; };
const toStoragePatch = (patch: Record<string, unknown>) => { const { scope, ...rest } = patch; return "scope" in patch ? { ...rest, project: typeof scope === "string" && scope !== "global" ? scope : null } : rest; };

function createMcpServer() {
  const mcp = new McpServer({ name: "memory-one", version: "0.1.0" });

mcp.tool("memory_store", "Store durable memory. Scope is an optional general-purpose category, such as a project directory, work area, or session.", {
  content: z.string(), kind: z.string().default("fact"), scope: z.string().nullable().optional(),
  session_id: z.string().nullable().optional(), source: z.string().nullable().optional(), occurred_at: z.string().nullable().optional(),
  confidence: z.number().default(1), importance: z.number().default(0.5), metadata: z.record(z.string(), z.unknown()).nullable().optional(),
}, async (input) => json(exposeMemory(store.create(toStorageInput(input as Record<string, unknown>)))));
mcp.tool("memory_search", "Search memories with SQLite FTS5. Scope is an optional general-purpose category filter.", { query: z.string(), scope: z.string().nullable().optional(), limit: z.number().int().default(20) }, async ({ query, scope, limit }) => json(exposeMemories(store.search(query, storageScope, scope && scope !== "global" ? scope : null, limit))));
mcp.tool("memory_get_context", "Return recent or query-focused memories for prompt context. Scope is an optional general-purpose category filter.", { query: z.string().nullable().optional(), scope: z.string().nullable().optional(), limit: z.number().int().default(10) }, async ({ query, scope, limit }) => { const category = scope && scope !== "global" ? scope : null; const memories = query ? store.search(query, storageScope, category, limit) : store.list(storageScope, category, limit); return json({ scope: scope ?? null, memories: exposeMemories(memories) }); });
mcp.tool("memory_get", "Get one memory by id.", { memory_id: z.string() }, async ({ memory_id }) => json(exposeMemory(store.get(memory_id) ?? { error: "memory_not_found" })));
mcp.tool("memory_list", "List memories. Scope is an optional general-purpose category filter.", { scope: z.string().nullable().optional(), limit: z.number().int().default(50) }, async ({ scope, limit }) => json(exposeMemories(store.list(storageScope, scope && scope !== "global" ? scope : null, limit))));
mcp.tool("memory_update", "Update a memory. Scope is an optional general-purpose category.", { memory_id: z.string(), patch: z.record(z.string(), z.unknown()) }, async ({ memory_id, patch }) => json(exposeMemory(store.update(memory_id, toStoragePatch(patch as Record<string, unknown>)) ?? { error: "memory_not_found" })));
mcp.tool("memory_delete", "Soft-delete a memory.", { memory_id: z.string() }, async ({ memory_id }) => json({ deleted: store.delete(memory_id) }));
mcp.tool("memory_feedback", "Record a simple relevance signal for a memory.", { memory_id: z.string(), useful: z.boolean() }, async ({ memory_id, useful }) => {
  const item = store.get(memory_id);
  if (!item) return json({ error: "memory_not_found" });
  return json(exposeMemory(store.update(memory_id, { importance: Math.max(0, Math.min(1, item.importance + (useful ? 0.05 : -0.05))) })));
});
  return mcp;
}

const app = Fastify({ logger: true });
const publicDir = join(fileURLToPath(new URL(".", import.meta.url)), "../public");
app.register(fastifyStatic, { root: publicDir, prefix: "/" });

app.get("/", async (_, reply) => reply.sendFile("index.html"));
app.get("/api/memories", async (request) => { const q = request.query as { scope?: string; project?: string; limit?: string }; return store.list(q.scope ?? "user", q.project ?? null, Number(q.limit ?? 50)); });
app.get("/api/search", async (request) => { const q = request.query as { query: string; scope?: string; project?: string; limit?: string }; return store.search(q.query, q.scope ?? "user", q.project ?? null, Number(q.limit ?? 20)); });
app.get("/api/memories/:id", async (request, reply) => { const { id } = request.params as { id: string }; const item = store.get(id); return item ? item : reply.code(404).send({ detail: "memory_not_found" }); });
app.post("/api/memories", async (request, reply) => { const payload = request.body as MemoryInput; if (!payload?.content) return reply.code(422).send({ detail: "content_required" }); return store.create(payload); });
app.patch("/api/memories/:id", async (request, reply) => { const { id } = request.params as { id: string }; const item = store.update(id, request.body as Partial<MemoryInput>); return item ? item : reply.code(404).send({ detail: "memory_not_found" }); });
app.delete("/api/memories/:id", async (request) => { const { id } = request.params as { id: string }; return { deleted: store.delete(id) }; });

app.all("/mcp", async (request, reply) => reply.redirect("/mcp/", 307));
app.all("/mcp/", async (request, reply) => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const mcp = createMcpServer();
  await mcp.connect(transport);
  await transport.handleRequest(request.raw, reply.raw, request.body);
  reply.hijack();
});

const port = Number(process.env.MEMORY_PORT ?? 8765);
app.listen({ host: "127.0.0.1", port }).then(() => console.log(`Memory One listening on http://127.0.0.1:${port}`));
