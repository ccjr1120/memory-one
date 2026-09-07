import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { MemoryStore, type AgentConfig, type MemoryInput } from "./storage.js";

const store = new MemoryStore();
const internalMcpToken = randomUUID();
let agentTurnQueue: Promise<void> = Promise.resolve();
const json = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }] });
const storageScope = "user";
const exposeMemory = (memory: any) => { if (!memory || typeof memory !== "object" || "error" in memory) return memory; const { project, ...rest } = memory; return { ...rest, scope: project ?? "global" }; };
const exposeMemories = (memories: any[]) => memories.map(exposeMemory);
const toStorageInput = (input: Record<string, unknown>) => { const { scope, ...rest } = input; return { ...rest, scope: storageScope, project: typeof scope === "string" && scope !== "global" ? scope : null } as MemoryInput; };
const toStoragePatch = (patch: Record<string, unknown>) => { const { scope, ...rest } = patch; return "scope" in patch ? { ...rest, project: typeof scope === "string" && scope !== "global" ? scope : null } : rest; };

type AgentToolCall = { name: string; label: string; count?: number };
type AgentChatRequest = { message?: string; history?: Array<{ role: "user" | "assistant"; content: string }>; provider?: string; model?: string; base_url?: string | null; api_key?: string | null; scope?: string | null; auto_context?: boolean; user_message_id?: string; assistant_message_id?: string };
type AgentEvent = { type: "delta"; text: string } | { type: "tool"; tool: AgentToolCall } | { type: "done"; toolCalls: AgentToolCall[] };
type ProviderMessage = Record<string, unknown>;

const agentSystemPrompt = "你是 Memory One 的记忆管家。你通过 MCP 工具管理用户的长期记忆，支持记忆的搜索、读取、保存、更新、删除和反馈。请先理解用户意图，涉及记忆事实时优先调用工具，不要编造记忆。删除前必须确认目标唯一；回复使用中文，简洁但可以使用 Markdown。";
const toolLabels: Record<string, string> = { memory_get_context: "读取相关上下文", memory_search: "搜索记忆", memory_get: "读取记忆", memory_list: "列出记忆", memory_store: "保存记忆", memory_update: "更新记忆", memory_delete: "删除记忆", memory_feedback: "记录反馈" };
const isMemoryOverviewRequest = (message: string) => /(?:有哪些|所有记忆|全部记忆|列出(?:全部)?|查看(?:全部)?|浏览全部|总结(?:下)?(?:我的)?记忆|总结我的特点|概括我的特点|我的画像|我的偏好和特点|我的记忆(?:有什么)?特点|记忆特点)/.test(message);

function sseEvent(type: string, payload: unknown) { return `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`; }

async function readSse(response: Response, onEvent: (event: { event: string; data: string }) => Promise<void> | void) {
  if (!response.body) throw new Error("provider_empty_stream");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const chunks = buffer.split(/\r?\n\r?\n/);
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      const lines = chunk.split(/\r?\n/);
      const event = lines.find((line) => line.startsWith("event:"))?.slice(6).trim() ?? "message";
      const data = lines.filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
      if (data) await onEvent({ event, data });
    }
    if (done) break;
  }
}

async function connectMemoryMcp() {
  const client = new Client({ name: "memory-one-agent", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${process.env.MEMORY_PORT ?? 8765}/mcp`), { requestInit: { headers: { "x-memory-one-internal": internalMcpToken } } });
  await client.connect(transport);
  return { client, transport };
}

function normalizeTools(tools: Array<{ name: string; description?: string; inputSchema: Record<string, unknown> }>) {
  return tools.map((tool) => ({ type: "function", function: { name: tool.name, description: tool.description ?? "", parameters: tool.inputSchema } }));
}

async function openAiRound(config: AgentChatRequest, messages: ProviderMessage[], tools: unknown[], emit: (event: AgentEvent) => void) {
  const base = (config.base_url?.trim() || "").replace(/\/$/, "");
  const response = await fetch(`${base}/chat/completions`, { method: "POST", headers: { "content-type": "application/json", ...(config.api_key ? { authorization: `Bearer ${config.api_key}` } : {}) }, body: JSON.stringify({ model: config.model || "", messages, tools, stream: true }) });
  if (!response.ok) throw new Error(`provider_http_${response.status}: ${await response.text()}`);
  let content = "";
  const calls = new Map<number, { id: string; name: string; arguments: string }>();
  await readSse(response, ({ data }) => {
    if (data === "[DONE]") return;
    const chunk = JSON.parse(data);
    const delta = chunk.choices?.[0]?.delta;
    if (delta?.content) { content += delta.content; emit({ type: "delta", text: delta.content }); }
    for (const call of delta?.tool_calls ?? []) {
      const existing = calls.get(call.index) ?? { id: call.id ?? "", name: call.function?.name ?? "", arguments: "" };
      existing.id ||= call.id ?? ""; existing.name ||= call.function?.name ?? ""; existing.arguments += call.function?.arguments ?? ""; calls.set(call.index, existing);
    }
  });
  return { content, toolCalls: [...calls.values()] };
}

function responsesInput(messages: ProviderMessage[]): Array<Record<string, unknown>> {
  return messages.filter((message) => message.role !== "system").flatMap((message): Array<Record<string, unknown>> => {
    if (message.role === "tool") return [{ type: "function_call_output", call_id: message.tool_call_id, output: message.content }];
    if (message.role === "assistant" && Array.isArray(message.tool_calls)) {
      return (message.tool_calls as Array<any>).map((call) => ({ type: "function_call", call_id: call.id, name: call.function.name, arguments: call.function.arguments }));
    }
    return [{ role: message.role, content: message.content }];
  });
}

async function openAiResponsesRound(config: AgentChatRequest, messages: ProviderMessage[], tools: unknown[], emit: (event: AgentEvent) => void) {
  const base = (config.base_url?.trim() || "").replace(/\/$/, "");
  const system = messages.find((message) => message.role === "system")?.content;
  const response = await fetch(`${base}/responses`, { method: "POST", headers: { "content-type": "application/json", ...(config.api_key ? { authorization: `Bearer ${config.api_key}` } : {}) }, body: JSON.stringify({ model: config.model || "", instructions: system, input: responsesInput(messages), tools: (tools as Array<any>).map((tool) => ({ type: "function", name: tool.function.name, description: tool.function.description, parameters: tool.function.parameters })), stream: false }) });
  if (!response.ok) throw new Error(`provider_http_${response.status}: ${await response.text()}`);
  const payload = await response.json() as any;
  let content = "";
  const toolCalls: Array<{ id: string; name: string; arguments: string }> = [];
  for (const item of payload.output ?? []) {
    if (item.type === "message") {
      for (const part of item.content ?? []) if (part.type === "output_text" && part.text) content += part.text;
    }
    if (item.type === "function_call") toolCalls.push({ id: item.call_id || item.id, name: item.name, arguments: item.arguments || "{}" });
  }
  if (content) emit({ type: "delta", text: content });
  return { content, toolCalls };
}

async function anthropicRound(config: AgentChatRequest, messages: ProviderMessage[], tools: unknown[], emit: (event: AgentEvent) => void) {
  const base = (config.base_url?.trim() || "").replace(/\/$/, "");
  const system = messages.find((message) => message.role === "system")?.content;
  const response = await fetch(`${base}/messages`, { method: "POST", headers: { "content-type": "application/json", "anthropic-version": "2023-06-01", ...(config.api_key ? { "x-api-key": config.api_key } : {}) }, body: JSON.stringify({ model: config.model || "claude-3-5-sonnet-latest", max_tokens: 4096, system, messages: messages.filter((message) => message.role !== "system"), tools: (tools as Array<any>).map((tool) => ({ name: tool.function.name, description: tool.function.description, input_schema: tool.function.parameters })), stream: true }) });
  if (!response.ok) throw new Error(`provider_http_${response.status}: ${await response.text()}`);
  let content = ""; const calls: Array<{ id: string; name: string; arguments: string }> = []; let current: any = null;
  await readSse(response, ({ event, data }) => {
    const item = JSON.parse(data);
    if (event === "content_block_start" && item.content_block?.type === "tool_use") { current = { id: item.content_block.id, name: item.content_block.name, arguments: "" }; calls.push(current); }
    if (event === "content_block_delta") { if (item.delta?.type === "text_delta") { content += item.delta.text; emit({ type: "delta", text: item.delta.text }); } if (item.delta?.type === "input_json_delta" && current) current.arguments += item.delta.partial_json; }
  });
  return { content, toolCalls: calls };
}

async function runAgent(request: AgentChatRequest, emit: (event: AgentEvent) => void) {
  const provider = (request.provider || "").toLowerCase();
  if (!request.message?.trim()) { emit({ type: "delta", text: "告诉我你想查找、保存、修改、删除，还是总结哪些记忆？" }); emit({ type: "done", toolCalls: [] }); return; }
  if (!["openai", "openai-compatible", "anthropic", "local"].includes(provider)) throw new Error("unsupported_provider");
  if (!request.base_url?.trim()) throw new Error("missing_base_url");
  if (provider !== "local" && !request.api_key) throw new Error("missing_api_key");
  const { client, transport } = await connectMemoryMcp();
  const toolResult = await client.listTools();
  const tools = normalizeTools(toolResult.tools as Array<{ name: string; description?: string; inputSchema: Record<string, unknown> }>);
  const toolCalls: AgentToolCall[] = [];
  const history = (request.history ?? []).slice(-12).filter((message) => message.content).map((message) => ({ role: message.role, content: message.content }));
  const messages: ProviderMessage[] = [{ role: "system", content: `${agentSystemPrompt}${request.scope ? ` 默认 Scope：${request.scope}` : ""}${request.auto_context === false ? " 不需要自动读取上下文。" : " 每轮任务开始时先调用 memory_get_context。"}` }, ...history];
  if (!history.some((message) => message.role === "user" && message.content === request.message)) messages.push({ role: "user", content: request.message });
  try {
    if (request.auto_context !== false) {
      const overviewRequest = isMemoryOverviewRequest(request.message);
      const context = await client.callTool({ name: "memory_get_context", arguments: { query: overviewRequest ? null : request.message, scope: request.scope || null, limit: overviewRequest ? 50 : 10 } }, CallToolResultSchema);
      const contextText = ((context as any).content as Array<{ type: string; text?: string }> | undefined)?.filter((item) => item.type === "text").map((item) => item.text ?? "").join("\n") || "{}";
      const parsed = (() => { try { return JSON.parse(contextText); } catch { return contextText; } })();
      toolCalls.push({ name: "memory_get_context", label: toolLabels.memory_get_context, count: Array.isArray(parsed) ? parsed.length : parsed?.memories?.length });
      emit({ type: "tool", tool: toolCalls.at(-1)! });
      messages[0] = { role: "system", content: `${messages[0].content}\n\n已自动读取 memory_get_context，结果如下。请基于这些结果回答，除非需要更精确检索，否则不要重复调用该工具：\n${contextText}` };
      if (overviewRequest) {
        const listed = await client.callTool({ name: "memory_list", arguments: { scope: request.scope || null, limit: 100 } }, CallToolResultSchema);
        const listedText = ((listed as any).content as Array<{ type: string; text?: string }> | undefined)?.filter((item) => item.type === "text").map((item) => item.text ?? "").join("\n") || "[]";
        const listedParsed = (() => { try { return JSON.parse(listedText); } catch { return []; } })();
        const listCall = { name: "memory_list", label: toolLabels.memory_list, count: Array.isArray(listedParsed) ? listedParsed.length : undefined };
        toolCalls.push(listCall);
        emit({ type: "tool", tool: listCall });
        messages[0] = { role: "system", content: `${messages[0].content}\n\n这是针对“有哪些记忆/总结特点”问题通过 MCP memory_list 获取的完整记忆列表。请直接基于它回答，不要声称没有上下文：\n${listedText}` };
      }
    }
    for (let round = 0; round < 6; round += 1) {
      const result = provider === "anthropic" ? await anthropicRound(request, messages, tools, emit) : provider === "openai" ? await openAiResponsesRound(request, messages, tools, emit) : await openAiRound(request, messages, tools, emit);
      if (!result.toolCalls.length) { emit({ type: "done", toolCalls }); return; }
      if (provider === "anthropic") messages.push({ role: "assistant", content: [...(result.content ? [{ type: "text", text: result.content }] : []), ...result.toolCalls.map((call) => ({ type: "tool_use", id: call.id, name: call.name, input: JSON.parse(call.arguments || "{}") }))] });
      else messages.push({ role: "assistant", content: result.content || null, tool_calls: result.toolCalls.map((call) => ({ id: call.id, type: "function", function: { name: call.name, arguments: call.arguments } })) });
      for (const call of result.toolCalls) {
        const args = JSON.parse(call.arguments || "{}");
        if (request.scope && ["memory_get_context", "memory_search", "memory_list", "memory_store"].includes(call.name) && args.scope == null) args.scope = request.scope;
        if (request.scope && call.name === "memory_update" && args.patch && typeof args.patch === "object" && args.patch.scope == null) args.patch = { ...args.patch, scope: request.scope };
        const output = await client.callTool({ name: call.name, arguments: args }, CallToolResultSchema);
        const outputContent = (output as any).content as Array<{ type: string; text?: string }> | undefined;
        const text = outputContent?.filter((item) => item.type === "text").map((item) => item.text ?? "").join("\n") || JSON.stringify(output);
        if (provider === "anthropic") messages.push({ role: "user", content: [{ type: "tool_result", tool_use_id: call.id, content: text }] });
        else messages.push({ role: "tool", tool_call_id: call.id, content: text });
        const count = (() => { try { const parsed = JSON.parse(text); return Array.isArray(parsed) ? parsed.length : parsed?.memories?.length ?? undefined; } catch { return undefined; } })();
        const latest = { name: call.name, label: toolLabels[call.name] ?? call.name, ...(count === undefined ? {} : { count }) };
        toolCalls.push(latest); emit({ type: "tool", tool: latest });
      }
    }
    throw new Error("agent_tool_loop_limit");
  } finally { await transport.close().catch(() => undefined); }
}
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

const mcpToolNames = ["memory_store", "memory_search", "memory_get_context", "memory_get", "memory_list", "memory_update", "memory_delete", "memory_feedback"] as const;

function createMcpServer(allowedTools?: Set<string>) {
  const mcp = new McpServer({ name: "memory-one", version: "0.1.0" }, {
    instructions: "Memory One provides durable experience for every task. At the start of each user task, call memory_get_context before planning, answering, editing, or using task-specific tools. Query with a concise summary of the current task and apply relevant retrieved memories. Use memory_search for focused follow-up retrieval. Proactively save durable preferences, decisions, project conventions, personal facts, and corrections with memory_store. Use memory_update when stored information is corrected or superseded. Use memory_feedback after retrieved memories prove useful or unhelpful. Only use memory_delete when the user explicitly asks to forget a specific memory. Scope is optional."
  });
  const registerTool = (name: string, description: string, schema: Record<string, z.ZodTypeAny>, handler: (input: any) => any) => {
    if (!allowedTools || allowedTools.has(name)) mcp.tool(name, description, schema, handler);
  };

registerTool("memory_store", "Use proactively when the user states a durable preference, decision, project convention, personal fact, or correction that can help in future tasks. Store it immediately instead of waiting for a separate request. Do not store transient chatter or one-off task details. Scope is an optional category such as a project directory, work area, or session.", {
  content: z.string(), kind: z.string().default("fact"), scope: z.string().nullable().optional(),
  session_id: z.string().nullable().optional(), source: z.string().nullable().optional(), occurred_at: z.string().nullable().optional(),
  confidence: z.number().default(1), importance: z.number().default(0.5), metadata: z.record(z.string(), z.unknown()).nullable().optional(),
}, async (input: any) => trackToolCall("memory_store", () => json(exposeMemory(store.create(toStorageInput(input as Record<string, unknown>))))));
registerTool("memory_search", "Use before answering when prior user preferences, past decisions, project conventions, or earlier facts may matter. Prefer searching over guessing, including when the answer seems obvious. Search with concise terms and use scope as an optional category filter.", { query: z.string(), scope: z.string().nullable().optional(), limit: z.number().int().default(20) }, async ({ query, scope, limit }: any) => trackToolCall("memory_search", () => json(exposeMemories(store.recordRecalls(store.search(query, storageScope, scope && scope !== "global" ? scope : null, limit))))));
registerTool("memory_get_context", "Universal pre-task context retrieval. Call once at the beginning of every user task, before planning, answering, editing, or invoking task-specific tools. Use a concise summary of the current task as the query and apply relevant returned experience.", { query: z.string().nullable().optional(), scope: z.string().nullable().optional(), limit: z.number().int().default(10) }, async ({ query, scope, limit }: any) => trackToolCall("memory_get_context", () => { const category = scope && scope !== "global" ? scope : null; const memories = query ? store.search(query, storageScope, category, limit) : store.list(storageScope, category, limit); return json({ scope: scope ?? null, memories: exposeMemories(store.recordRecalls(memories)) }); }));
registerTool("memory_get", "Use after memory_search or memory_get_context returns a memory ID and you need the complete record before relying on or updating it.", { memory_id: z.string() }, async ({ memory_id }: any) => trackToolCall("memory_get", () => { const memory = store.get(memory_id); return json(exposeMemory(memory ? store.recordRecalls([memory])[0] : { error: "memory_not_found" })); }));
registerTool("memory_list", "Use when reviewing recent memories, auditing what has been saved, or preparing context without a specific search query. Scope is an optional category filter.", { scope: z.string().nullable().optional(), limit: z.number().int().default(50) }, async ({ scope, limit }: any) => trackToolCall("memory_list", () => json(exposeMemories(store.list(storageScope, scope && scope !== "global" ? scope : null, limit)))));
registerTool("memory_update", "Use when the user corrects, refines, or supersedes a stored memory. Fetch the record first when needed, then update only the changed fields. Scope is an optional category.", { memory_id: z.string(), patch: z.record(z.string(), z.unknown()) }, async ({ memory_id, patch }: any) => trackToolCall("memory_update", () => json(exposeMemory(store.update(memory_id, toStoragePatch(patch as Record<string, unknown>)) ?? { error: "memory_not_found" }))));
registerTool("memory_delete", "Use only when the user explicitly asks to forget or delete a specific memory. This is a soft delete.", { memory_id: z.string() }, async ({ memory_id }: any) => trackToolCall("memory_delete", () => json({ deleted: store.delete(memory_id) })));
registerTool("memory_feedback", "Use after applying a retrieved memory or when the user indicates that a memory was useful or not useful. Record that relevance signal so future retrieval can improve.", { memory_id: z.string(), useful: z.boolean() }, async ({ memory_id, useful }: any) => {
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
app.get("/api/search", async (request) => { const q = request.query as { query: string; scope?: string; project?: string; limit?: string }; return store.recordRecalls(store.search(q.query, q.scope ?? "user", q.project ?? null, Number(q.limit ?? 20))); });
app.get("/api/memories/most-recalled", async (request) => { const q = request.query as { scope?: string; project?: string; limit?: string }; return store.mostRecalled(q.scope ?? "user", q.project ?? null, Number(q.limit ?? 5)); });
app.get("/api/mcp/stats", async () => store.getToolStats());
app.get("/api/mcp/config", async () => store.getMcpConfig());
app.put("/api/mcp/config", async (request) => store.saveMcpConfig(Boolean((request.body as { use_bearer_key?: boolean } | undefined)?.use_bearer_key)));
app.get("/api/mcp/keys", async () => store.listMcpKeys());
app.post("/api/mcp/keys", async (request, reply) => {
  const body = (request.body as { name?: string; allowed_tools?: string[] } | undefined) ?? {};
  const name = body.name?.trim() || "未命名 Key";
  const allowedTools = [...new Set((body.allowed_tools ?? []).filter((tool) => (mcpToolNames as readonly string[]).includes(tool)))];
  const created = store.createMcpKey(name, allowedTools);
  return reply.code(201).send({ key: created.key, key_record: created.keyRecord });
});
app.patch("/api/mcp/keys/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  const body = (request.body as { name?: string; allowed_tools?: string[] } | undefined) ?? {};
  const patch = {
    ...(body.name === undefined ? {} : { name: body.name.trim() || "未命名 Key" }),
    ...(body.allowed_tools === undefined ? {} : { allowed_tools: [...new Set(body.allowed_tools.filter((tool) => (mcpToolNames as readonly string[]).includes(tool)))] }),
  };
  const key = store.updateMcpKey(id, patch);
  return key ? key : reply.code(404).send({ detail: "mcp_key_not_found" });
});
app.delete("/api/mcp/keys/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  return { revoked: store.revokeMcpKey(id) };
});
app.get("/api/agent/config", async () => store.getAgentConfig());
app.put("/api/agent/config", async (request, reply) => {
  const body = (request.body as Partial<AgentConfig> | undefined) ?? {};
  return reply.send(store.saveAgentConfig(body));
});
app.get("/api/agent/messages", async () => store.listAgentMessages());
app.post("/api/agent/messages", async (request, reply) => {
  const body = request.body as { id?: string; role?: "user" | "assistant"; content?: string; toolCalls?: unknown[] } | undefined;
  if (!body?.id || !body.role || typeof body.content !== "string") return reply.code(422).send({ detail: "message_required" });
  return store.saveAgentMessage({ id: body.id, role: body.role, content: body.content, toolCalls: body.toolCalls });
});
app.post("/api/agent/chat", async (request, reply) => {
  try {
    let text = ""; const toolCalls: AgentToolCall[] = [];
    await runAgent((request.body as AgentChatRequest | undefined) ?? {}, (event) => { if (event.type === "delta") text += event.text; if (event.type === "done") toolCalls.push(...event.toolCalls); });
    return { reply: text, toolCalls };
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ detail: error instanceof Error ? error.message : "agent_request_failed" });
  }
});
app.post("/api/agent/models", async (request, reply) => {
  const body = (request.body as { provider?: string; base_url?: string | null; api_key?: string | null } | undefined) ?? {};
  const provider = (body.provider || "").toLowerCase();
  if (!["openai", "openai-compatible", "anthropic", "local"].includes(provider)) return reply.code(422).send({ detail: "unsupported_provider" });
  const base = (body.base_url?.trim() || "").replace(/\/$/, "");
  if (!base) return reply.code(422).send({ detail: "base_url_required" });
  const headers: Record<string, string> = { accept: "application/json" };
  if (provider === "anthropic") {
    headers["anthropic-version"] = "2023-06-01";
    if (body.api_key?.trim()) headers["x-api-key"] = body.api_key.trim();
  } else if (body.api_key?.trim()) {
    headers.authorization = `Bearer ${body.api_key.trim()}`;
  }
  try {
    const response = await fetch(`${base}/models`, { headers });
    const text = await response.text();
    let payload: any = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }
    if (!response.ok) return reply.code(response.status >= 400 && response.status < 600 ? response.status : 502).send({ detail: payload?.error?.message || payload?.message || text || "model_list_failed" });
    const entries: unknown[] = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
    const models = [...new Set(entries.map((item: unknown) => typeof item === "string" ? item : (item as { id?: unknown })?.id).filter((item): item is string => typeof item === "string" && item.trim().length > 0))];
    return { models };
  } catch (error) {
    request.log.error(error);
    return reply.code(502).send({ detail: "model_list_unreachable" });
  }
});
app.post("/api/agent/stream", async (request, reply) => {
  const body = ((request.body as AgentChatRequest | undefined) ?? {});
  const userMessageId = body.user_message_id;
  const assistantMessageId = body.assistant_message_id;
  if (userMessageId && body.message) store.saveAgentMessage({ id: userMessageId, role: "user", content: body.message });
  if (assistantMessageId) store.saveAgentMessage({ id: assistantMessageId, role: "assistant", content: "", toolCalls: [] });
  let assistantContent = "";
  let assistantTools: AgentToolCall[] = [];
  reply.hijack();
  reply.raw.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", connection: "keep-alive", "x-accel-buffering": "no" });
  const turn = agentTurnQueue.then(async () => {
    const allMessages = store.listAgentMessages(1000).filter((item) => item.content);
    const currentIndex = userMessageId ? allMessages.findIndex((item) => item.id === userMessageId) : allMessages.length - 1;
    const storedHistory = allMessages.slice(0, Math.max(0, currentIndex)).map((item) => ({ role: item.role, content: item.content })).slice(-12);
    await runAgent({ ...body, history: storedHistory }, (event) => {
      if (event.type === "delta") assistantContent += event.text;
      if (event.type === "tool") assistantTools = [...assistantTools, event.tool];
      if (event.type === "done") assistantTools = event.toolCalls;
      if (assistantMessageId) store.saveAgentMessage({ id: assistantMessageId, role: "assistant", content: assistantContent, toolCalls: assistantTools });
      if (!reply.raw.destroyed) reply.raw.write(sseEvent(event.type, event.type === "delta" ? { text: event.text } : event.type === "tool" ? event.tool : { toolCalls: event.toolCalls }));
    });
  });
  agentTurnQueue = turn.catch(() => undefined);
  try {
    await turn;
  } catch (error) {
    request.log.error(error);
    reply.raw.write(sseEvent("error", { detail: error instanceof Error ? error.message : "agent_request_failed" }));
  } finally { reply.raw.end(); }
});
app.get("/api/integrations/codex", async () => getCodexIntegration());
app.post("/api/integrations/codex/install", async () => installCodexIntegration());
app.get("/api/memories/:id", async (request, reply) => { const { id } = request.params as { id: string }; const item = store.get(id); return item ? item : reply.code(404).send({ detail: "memory_not_found" }); });
app.post("/api/memories", async (request, reply) => { const payload = request.body as MemoryInput; if (!payload?.content) return reply.code(422).send({ detail: "content_required" }); return store.create(payload); });
app.patch("/api/memories/:id", async (request, reply) => { const { id } = request.params as { id: string }; const item = store.update(id, request.body as Partial<MemoryInput>); return item ? item : reply.code(404).send({ detail: "memory_not_found" }); });
app.delete("/api/memories/:id", async (request) => { const { id } = request.params as { id: string }; return { deleted: store.delete(id) }; });

app.all("/mcp", async (request, reply) => reply.redirect("/mcp/", 307));
app.all("/mcp/", async (request, reply) => {
  const internal = request.headers["x-memory-one-internal"] === internalMcpToken;
  const authorization = request.headers.authorization;
  const secret = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const key = secret ? store.verifyMcpKey(secret) : null;
  if (!internal && (!secret || !key)) return reply.code(401).header("www-authenticate", "Bearer").send({ error: secret ? "invalid_mcp_key" : "mcp_key_required" });
  const allowedTools = key && key.allowed_tools.length ? new Set(key.allowed_tools) : undefined;
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const mcp = createMcpServer(allowedTools);
  await mcp.connect(transport);
  await transport.handleRequest(request.raw, reply.raw, request.body);
  reply.hijack();
});

const port = Number(process.env.MEMORY_PORT ?? 8765);
app.listen({ host: "127.0.0.1", port }).then(() => console.log(`Memory One listening on http://127.0.0.1:${port}`));
