import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CONTEXT_TOKEN_BUDGET, MemoryStore, type ContextSelection, type Memory } from "../storage.js";
import { ContextCache } from "./context-cache.js";

export const mcpToolNames = ["memory_store", "memory-search", "memory-get-context", "memory_get", "memory_list", "memory_update", "memory_delete", "memory_feedback"] as const;
const storageScope = "user";
const json = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }] });
export const exposeMemory = (memory: any) => {
  if (!memory || typeof memory !== "object" || "error" in memory) return memory;
  const { project, ...rest } = memory;
  return { ...rest, scope: project ?? "global" };
};
const exposeMemories = (memories: Memory[]) => memories.map(exposeMemory);
const exposeWriteResult = (result: { memory: Memory; duplicate: boolean; similar: Memory[]; superseded?: Memory | null }) => ({
  memory: exposeMemory(result.memory),
  duplicate: result.duplicate,
  similar: exposeMemories(result.similar),
  superseded: result.superseded ? exposeMemory(result.superseded) : null,
});
const toStorageInput = (input: Record<string, unknown>) => {
  const { scope, ...rest } = input;
  return { ...rest, scope: storageScope, project: typeof scope === "string" && scope !== "global" ? scope : null } as any;
};
const toStoragePatch = (patch: Record<string, unknown>) => {
  const { scope, ...rest } = patch;
  return "scope" in patch ? { ...rest, project: typeof scope === "string" && scope !== "global" ? scope : null } : rest;
};

export function createMcpServer(store: MemoryStore, allowedTools?: Set<string>, contextCache?: ContextCache, cacheIdentity = "internal") {
  const mcp = new McpServer({ name: "memory-one", version: "0.1.0" }, {
    instructions: "Memory One provides durable experience for every task. At the start of each new user task, call memory-get-context before planning, answering, editing, or using task-specific tools. It returns persistent preferences and project conventions without a query. If its result is already present in the current task conversation, do not call it again; use memory-search for focused retrieval of specific historical information. Only save a memory when the user explicitly asks to remember or save it; if a durable preference, decision, project convention, personal fact, or correction seems worth keeping but the user did not ask, ask for confirmation instead. Use memory_update only after the user explicitly asks to change an existing memory. Do not save clearly transient, one-off details. Before storing, prefer updating or superseding a similar memory instead of creating a near-duplicate. Use memory_feedback after retrieved memories prove useful or unhelpful. Only use memory_delete when the user explicitly asks to forget a specific memory. Scope is optional."
  });
  const registerTool = (name: string, description: string, schema: Record<string, z.ZodTypeAny>, handler: (input: any) => any) => {
    if (!allowedTools || allowedTools.has(name)) {
      mcp.tool(name, description, schema, async (input: any) => {
        const startedAt = performance.now();
        try {
          const result = await handler(input);
          store.recordToolCall(name, true, Math.round((performance.now() - startedAt) * 100) / 100);
          return result;
        } catch (error) {
          store.recordToolCall(name, false, Math.round((performance.now() - startedAt) * 100) / 100);
          throw error;
        }
      });
    }
  };
  registerTool("memory_store", "Use only when the user explicitly asks to remember or save a durable preference, decision, project convention, personal fact, or correction. If the information may be useful but the user did not ask to save it, ask for confirmation first. Do not store transient chatter or one-off task details. If an older memory should be replaced, pass its supersedes_id. Scope is an optional category such as a project directory, work area, or session.", {
    content: z.string(), kind: z.string().default("fact"), scope: z.string().nullable().optional(),
    session_id: z.string().nullable().optional(), source: z.string().nullable().optional(), occurred_at: z.string().nullable().optional(),
    confidence: z.number().default(1), importance: z.number().default(0.5), metadata: z.record(z.string(), z.unknown()).nullable().optional(),
    supersedes_id: z.string().nullable().optional(),
  }, async (input: any) => json(exposeWriteResult(store.createWithIntegrity(toStorageInput(input)))));
  registerTool("memory-search", "Use when a specific historical preference, decision, fact, or project convention may matter. Search with 5–12 concise high-signal concepts or identifiers, not the full user message; use scope as an optional category filter.", { query: z.string(), scope: z.string().nullable().optional(), limit: z.number().int().default(20) }, async ({ query, scope, limit }: any) => json(exposeMemories(store.recordRecalls(store.search(query, storageScope, scope && scope !== "global" ? scope : null, limit), "search", query))));
  registerTool("memory-get-context", "Use once at the beginning of each new user task. Do not call it again when this task's conversation already contains a memory-get-context result; use memory-search for focused follow-up retrieval. Returns token-budgeted persistent memories, prioritizing the current project before global memories. Do not pass a query. When working in a Git repository, pass the repository root's absolute directory path as scope. Scope is optional.", { scope: z.string().nullable().optional(), limit: z.number().int().default(10) }, async ({ scope, limit }: any) => {
    const category = scope && scope !== "global" ? scope : null;
    const version = store.dataVersion();
    const cached = contextCache?.get(cacheIdentity, category, limit, version) as ContextSelection | null;
    const selection = cached ?? store.persistentContext(storageScope, category, limit, CONTEXT_TOKEN_BUDGET);
    if (!cached) contextCache?.set(cacheIdentity, category, limit, version, selection);
    const memories = exposeMemories(store.recordRecalls(selection.memories, "context")) as Memory[];
    return json({ scope: scope ?? "global", strategy: selection.strategy, token_budget: selection.token_budget, token_estimate: selection.token_estimate, cache_hit: Boolean(cached), memories });
  });
  registerTool("memory_get", "Use after memory-search or memory-get-context returns a memory ID and you need the complete record before relying on or updating it.", { memory_id: z.string() }, async ({ memory_id }: any) => {
    const memory = store.get(memory_id);
    return json(memory ? exposeMemory(store.recordRecalls([memory], "get")[0]) : { error: "memory_not_found" });
  });
  registerTool("memory_list", "Use when reviewing recent memories, auditing what has been saved, or preparing context without a specific search query. Scope is an optional category filter.", { scope: z.string().nullable().optional(), limit: z.number().int().default(50) }, async ({ scope, limit }: any) => json(exposeMemories(store.recordRecalls(store.list(storageScope, scope && scope !== "global" ? scope : null, limit), "list"))));
  registerTool("memory_update", "Use only when the user explicitly asks to correct, refine, or supersede a stored memory. Fetch the record first when needed, then update only the changed fields. Scope is an optional category.", { memory_id: z.string(), patch: z.record(z.string(), z.unknown()) }, async ({ memory_id, patch }: any) => json(exposeMemory(store.update(memory_id, toStoragePatch(patch as Record<string, unknown>)) ?? { error: "memory_not_found" })));
  registerTool("memory_delete", "Use only when the user explicitly asks to forget or delete a specific memory. This is a soft delete.", { memory_id: z.string() }, async ({ memory_id }: any) => json({ deleted: store.delete(memory_id) }));
  registerTool("memory_feedback", "Use after applying a retrieved memory or when the user indicates that a memory was useful or not useful. Record that relevance signal so future retrieval can improve.", { memory_id: z.string(), useful: z.boolean() }, async ({ memory_id, useful }: any) => {
    const item = store.get(memory_id);
    if (!item) return json({ error: "memory_not_found" });
    return json(exposeMemory(store.update(memory_id, { importance: Math.max(0, Math.min(1, item.importance + (useful ? 0.05 : -0.05))) })));
  });
  return mcp;
}
