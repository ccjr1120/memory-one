import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
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
const codexAgentsPath = join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "AGENTS.md");
const codexGuidanceStart = "<!-- memory-one:codex:start -->";
const codexGuidanceEnd = "<!-- memory-one:codex:end -->";
const codexGuidance = `${codexGuidanceStart}
## Memory One

Before starting any user task, call the Memory One MCP tool \`memory_get_context\` once to retrieve relevant prior experience.

- Use a concise summary of the current task as the query.
- Omit \`scope\` unless a useful category is known.
- Apply relevant preferences, decisions, corrections, and lessons before planning, answering, editing files, or calling task-specific tools.
- Do not skip retrieval merely because the task appears self-contained.
${codexGuidanceEnd}`;

async function readCodexAgents() {
  try {
    return await readFile(codexAgentsPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw error;
  }
}

function removeManagedCodexGuidance(content: string) {
  const start = content.indexOf(codexGuidanceStart);
  const end = content.indexOf(codexGuidanceEnd, start + codexGuidanceStart.length);
  if (start < 0 || end < 0) return content;
  const before = content.slice(0, start).trimEnd();
  const after = content.slice(end + codexGuidanceEnd.length).trimStart();
  return [before, after].filter(Boolean).join("\n\n");
}

async function getCodexIntegration() {
  const content = await readCodexAgents();
  const start = content.indexOf(codexGuidanceStart);
  const end = content.indexOf(codexGuidanceEnd, start + codexGuidanceStart.length);
  const installed = start >= 0 && end >= 0;
  const managed = installed ? content.slice(start, end + codexGuidanceEnd.length) : "";
  return { path: codexAgentsPath, status: installed ? managed === codexGuidance ? "configured" : "update_available" : "not_configured" };
}

async function installCodexIntegration() {
  const content = await readCodexAgents();
  const preserved = removeManagedCodexGuidance(content);
  await mkdir(dirname(codexAgentsPath), { recursive: true });
  await writeFile(codexAgentsPath, `${preserved ? `${preserved}\n\n` : ""}${codexGuidance}\n`, "utf8");
  return getCodexIntegration();
}

async function trackToolCall<T>(toolName: string, action: () => T | Promise<T>): Promise<T> {
  const startedAt = performance.now();
  try {
    const result = await action();
    store.recordToolCall(toolName, true, Math.round((performance.now() - startedAt) * 100) / 100);
    return result;
  } catch (error) {
    store.recordToolCall(toolName, false, Math.round((performance.now() - startedAt) * 100) / 100);
    throw error;
  }
}

function createMcpServer() {
  const mcp = new McpServer({ name: "memory-one", version: "0.1.0" }, {
    instructions: "Memory One provides durable experience for every task. At the start of each user task, call memory_get_context before planning, answering, editing, or using task-specific tools. Query with a concise summary of the current task and apply relevant retrieved memories. Use memory_search for focused follow-up retrieval. Proactively save durable preferences, decisions, project conventions, personal facts, and corrections with memory_store. Use memory_update when stored information is corrected or superseded. Use memory_feedback after retrieved memories prove useful or unhelpful. Only use memory_delete when the user explicitly asks to forget a specific memory. Scope is optional."
  });

mcp.tool("memory_store", "Use proactively when the user states a durable preference, decision, project convention, personal fact, or correction that can help in future tasks. Store it immediately instead of waiting for a separate request. Do not store transient chatter or one-off task details. Scope is an optional category such as a project directory, work area, or session.", {
  content: z.string(), kind: z.string().default("fact"), scope: z.string().nullable().optional(),
  session_id: z.string().nullable().optional(), source: z.string().nullable().optional(), occurred_at: z.string().nullable().optional(),
  confidence: z.number().default(1), importance: z.number().default(0.5), metadata: z.record(z.string(), z.unknown()).nullable().optional(),
}, async (input) => trackToolCall("memory_store", () => json(exposeMemory(store.create(toStorageInput(input as Record<string, unknown>))))));
mcp.tool("memory_search", "Use before answering when prior user preferences, past decisions, project conventions, or earlier facts may matter. Prefer searching over guessing, including when the answer seems obvious. Search with concise terms and use scope as an optional category filter.", { query: z.string(), scope: z.string().nullable().optional(), limit: z.number().int().default(20) }, async ({ query, scope, limit }) => trackToolCall("memory_search", () => json(exposeMemories(store.search(query, storageScope, scope && scope !== "global" ? scope : null, limit)))));
mcp.tool("memory_get_context", "Universal pre-task context retrieval. Call once at the beginning of every user task, before planning, answering, editing, or invoking task-specific tools. Use a concise summary of the current task as the query and apply relevant returned experience.", { query: z.string().nullable().optional(), scope: z.string().nullable().optional(), limit: z.number().int().default(10) }, async ({ query, scope, limit }) => trackToolCall("memory_get_context", () => { const category = scope && scope !== "global" ? scope : null; const memories = query ? store.search(query, storageScope, category, limit) : store.list(storageScope, category, limit); return json({ scope: scope ?? null, memories: exposeMemories(memories) }); }));
mcp.tool("memory_get", "Use after memory_search or memory_get_context returns a memory ID and you need the complete record before relying on or updating it.", { memory_id: z.string() }, async ({ memory_id }) => trackToolCall("memory_get", () => json(exposeMemory(store.get(memory_id) ?? { error: "memory_not_found" }))));
mcp.tool("memory_list", "Use when reviewing recent memories, auditing what has been saved, or preparing context without a specific search query. Scope is an optional category filter.", { scope: z.string().nullable().optional(), limit: z.number().int().default(50) }, async ({ scope, limit }) => trackToolCall("memory_list", () => json(exposeMemories(store.list(storageScope, scope && scope !== "global" ? scope : null, limit)))));
mcp.tool("memory_update", "Use when the user corrects, refines, or supersedes a stored memory. Fetch the record first when needed, then update only the changed fields. Scope is an optional category.", { memory_id: z.string(), patch: z.record(z.string(), z.unknown()) }, async ({ memory_id, patch }) => trackToolCall("memory_update", () => json(exposeMemory(store.update(memory_id, toStoragePatch(patch as Record<string, unknown>)) ?? { error: "memory_not_found" }))));
mcp.tool("memory_delete", "Use only when the user explicitly asks to forget or delete a specific memory. This is a soft delete.", { memory_id: z.string() }, async ({ memory_id }) => trackToolCall("memory_delete", () => json({ deleted: store.delete(memory_id) })));
mcp.tool("memory_feedback", "Use after applying a retrieved memory or when the user indicates that a memory was useful or not useful. Record that relevance signal so future retrieval can improve.", { memory_id: z.string(), useful: z.boolean() }, async ({ memory_id, useful }) => {
  return trackToolCall("memory_feedback", () => {
    const item = store.get(memory_id);
    if (!item) return json({ error: "memory_not_found" });
    return json(exposeMemory(store.update(memory_id, { importance: Math.max(0, Math.min(1, item.importance + (useful ? 0.05 : -0.05))) })));
  });
});
  return mcp;
}

const app = Fastify({ logger: true });
const publicDir = join(fileURLToPath(new URL(".", import.meta.url)), "../public");
app.register(fastifyStatic, { root: publicDir, prefix: "/" });

for (const frontendRoute of ["/", "/timeline", "/archive", "/preferences", "/scopes", "/tags", "/settings", "/mcp-service"]) {
  app.get(frontendRoute, async (_, reply) => reply.sendFile("index.html"));
}
app.get("/api/memories", async (request) => { const q = request.query as { scope?: string; project?: string; limit?: string }; return store.list(q.scope ?? "user", q.project ?? null, Number(q.limit ?? 50)); });
app.get("/api/search", async (request) => { const q = request.query as { query: string; scope?: string; project?: string; limit?: string }; return store.search(q.query, q.scope ?? "user", q.project ?? null, Number(q.limit ?? 20)); });
app.get("/api/mcp/stats", async () => store.getToolStats());
app.get("/api/integrations/codex", async () => getCodexIntegration());
app.post("/api/integrations/codex/install", async () => installCodexIntegration());
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
