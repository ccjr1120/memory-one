import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import type { MemoryStore } from "../storage.js";
import { runAgent } from "../agent/run.js";
import type { AgentChatRequest, AgentToolCall, MemoryMcpConnector } from "../agent/types.js";

const sseEvent = (type: string, payload: unknown, id?: number) => `${id === undefined ? "" : `id: ${id}\n`}event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;

export function registerAgentRoutes(app: FastifyInstance, store: MemoryStore, connectMemoryMcp: MemoryMcpConnector) {
  let agentTurnQueue: Promise<void> = Promise.resolve();
  const queueTurn = (turn: Promise<void>) => { agentTurnQueue = turn.catch(() => undefined); };
  const emitExecutionEvent = (executionId: string, type: string, data: unknown, reply?: any) => {
    const event = store.appendAgentExecutionEvent(executionId, type, data);
    if (reply && !reply.raw.destroyed) reply.raw.write(sseEvent(type, data, event.id));
    return event;
  };

  app.get("/api/agent/config", async () => store.getAgentConfig());
  app.put("/api/agent/config", async (request) => store.saveAgentConfig((request.body as object | undefined) ?? {}));
  app.get("/api/agent/messages", async () => store.listAgentMessages());
  app.post("/api/agent/messages", async (request, reply) => {
    const body = request.body as { id?: string; role?: "user" | "assistant"; content?: string; toolCalls?: unknown[] } | undefined;
    if (!body?.id || !body.role || typeof body.content !== "string") return reply.code(422).send({ detail: "message_required" });
    return store.saveAgentMessage({ id: body.id, role: body.role, content: body.content, toolCalls: body.toolCalls });
  });
  app.post("/api/agent/executions", async (request, reply) => {
    const body = ((request.body as AgentChatRequest | undefined) ?? {});
    if (!body.message?.trim()) return reply.code(422).send({ detail: "message_required" });
    const userMessageId = randomUUID();
    const assistantMessageId = randomUUID();
    const history = (body.history ?? []).slice(-12);
    store.saveAgentMessage({ id: userMessageId, role: "user", content: body.message });
    store.saveAgentMessage({ id: assistantMessageId, role: "assistant", content: "", toolCalls: [] });
    const execution = store.createAgentExecution({ messageIds: [userMessageId, assistantMessageId] });
    const turn = agentTurnQueue.then(async () => {
      let content = "";
      let toolCalls: AgentToolCall[] = [];
      try {
        await runAgent({ ...body, history }, (event) => {
          if (event.type === "delta") content += event.text;
          if (event.type === "tool") toolCalls = [...toolCalls, event.tool];
          if (event.type === "done") toolCalls = event.toolCalls;
          store.saveAgentMessage({ id: assistantMessageId, role: "assistant", content, toolCalls });
        }, connectMemoryMcp);
        store.updateAgentExecution(execution!.id, { status: "completed" });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "agent_request_failed";
        store.updateAgentExecution(execution!.id, { status: "failed", error: errorMessage });
        emitExecutionEvent(execution!.id, "status", { status: "failed", error: errorMessage });
      }
    });
    queueTurn(turn);
    return reply.code(202).send(store.getAgentExecution(execution!.id));
  });
  app.get("/api/agent/executions/:executionId/events", async (request, reply) => {
    const { executionId } = request.params as { executionId: string };
    if (!store.getAgentExecution(executionId)) return reply.code(404).send({ detail: "execution_not_found" });
    const header = request.headers["last-event-id"];
    const query = request.query as { after?: string };
    const after = Number(header ?? query.after ?? 0) || 0;
    reply.hijack();
    reply.raw.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", connection: "keep-alive", "x-accel-buffering": "no" });
    let closed = false;
    request.raw.on("close", () => { closed = true; });
    const send = () => { for (const event of store.listAgentExecutionEvents(executionId, after)) if (!closed) reply.raw.write(sseEvent(event.type, event.data, event.id)); };
    send();
    const timer = setInterval(() => { if (closed) { clearInterval(timer); return; } send(); }, 250);
    request.raw.on("close", () => { clearInterval(timer); if (!reply.raw.destroyed) reply.raw.end(); });
  });
  app.get("/api/agent/executions/:executionId", async (request, reply) => {
    const { executionId } = request.params as { executionId: string };
    const execution = store.getAgentExecution(executionId);
    return execution ? execution : reply.code(404).send({ detail: "execution_not_found" });
  });
  app.post("/api/agent/executions/:executionId/messages", async (request, reply) => {
    const { executionId } = request.params as { executionId: string };
    const execution = store.getAgentExecution(executionId);
    const body = (request.body as AgentChatRequest | undefined) ?? {};
    if (!execution) return reply.code(404).send({ detail: "execution_not_found" });
    if (execution.status !== "completed" && execution.status !== "failed" && execution.status !== "cancelled") return reply.code(409).send({ detail: "execution_in_progress" });
    if (!body.message?.trim()) return reply.code(422).send({ detail: "message_required" });
    const userMessageId = randomUUID();
    const assistantMessageId = randomUUID();
    store.saveAgentMessage({ id: userMessageId, role: "user", content: body.message });
    store.saveAgentMessage({ id: assistantMessageId, role: "assistant", content: "", toolCalls: [] });
    store.updateAgentExecution(executionId, { status: "running", messageIds: [...execution.messageIds, userMessageId, assistantMessageId], error: null });
    const history = [...execution.messages, { id: userMessageId, role: "user" as const, content: body.message }].slice(-12).map((message) => ({ role: message.role, content: message.content }));
    const turn = agentTurnQueue.then(async () => {
      let content = "";
      let toolCalls: AgentToolCall[] = [];
      try {
        await runAgent({ ...body, history }, (event) => {
          if (event.type === "delta") content += event.text;
          if (event.type === "tool") toolCalls = [...toolCalls, event.tool];
          if (event.type === "done") toolCalls = event.toolCalls;
          store.saveAgentMessage({ id: assistantMessageId, role: "assistant", content, toolCalls });
        }, connectMemoryMcp);
        store.updateAgentExecution(executionId, { status: "completed" });
      } catch (error) { store.updateAgentExecution(executionId, { status: "failed", error: error instanceof Error ? error.message : "agent_request_failed" }); }
    });
    queueTurn(turn);
    return reply.code(202).send(store.getAgentExecution(executionId));
  });
  app.post("/api/agent/executions/:executionId/cancel", async (request, reply) => {
    const { executionId } = request.params as { executionId: string };
    const execution = store.getAgentExecution(executionId);
    if (!execution) return reply.code(404).send({ detail: "execution_not_found" });
    if (execution.status === "running") { store.updateAgentExecution(executionId, { status: "cancelled" }); emitExecutionEvent(executionId, "status", { status: "cancelled" }); }
    return store.getAgentExecution(executionId);
  });
  app.post("/api/agent/executions/:executionId/retry", async (request, reply) => {
    const { executionId } = request.params as { executionId: string };
    const execution = store.getAgentExecution(executionId);
    if (!execution) return reply.code(404).send({ detail: "execution_not_found" });
    if (execution.status === "running") return reply.code(409).send({ detail: "execution_in_progress" });
    const lastUser = [...execution.messages].reverse().find((message) => message.role === "user");
    if (!lastUser) return reply.code(422).send({ detail: "message_required" });
    const body = (request.body as Omit<AgentChatRequest, "message" | "history"> | undefined) ?? {};
    const messageIds = [...execution.messageIds, randomUUID(), randomUUID()];
    const userMessageId = messageIds.at(-2)!;
    const assistantMessageId = messageIds.at(-1)!;
    store.saveAgentMessage({ id: userMessageId, role: "user", content: lastUser.content });
    store.saveAgentMessage({ id: assistantMessageId, role: "assistant", content: "", toolCalls: [] });
    store.updateAgentExecution(executionId, { status: "running", messageIds, error: null });
    const history = [...execution.messages.filter((message) => message.id !== lastUser.id), { role: "user" as const, content: lastUser.content }].slice(-12).map((message) => ({ role: message.role, content: message.content }));
    const turn = agentTurnQueue.then(async () => {
      let content = "";
      let toolCalls: AgentToolCall[] = [];
      try {
        await runAgent({ ...body, message: lastUser.content, history }, (event) => {
          if (event.type === "delta") content += event.text;
          if (event.type === "tool") toolCalls = [...toolCalls, event.tool];
          if (event.type === "done") toolCalls = event.toolCalls;
          store.saveAgentMessage({ id: assistantMessageId, role: "assistant", content, toolCalls });
        }, connectMemoryMcp);
        store.updateAgentExecution(executionId, { status: "completed" });
      } catch (error) { store.updateAgentExecution(executionId, { status: "failed", error: error instanceof Error ? error.message : "agent_request_failed" }); }
    });
    queueTurn(turn);
    return reply.code(202).send(store.getAgentExecution(executionId));
  });
  app.post("/api/agent/chat", async (request, reply) => {
    try {
      let text = "";
      const toolCalls: AgentToolCall[] = [];
      await runAgent((request.body as AgentChatRequest | undefined) ?? {}, (event) => {
        if (event.type === "delta") text += event.text;
        if (event.type === "done") toolCalls.push(...event.toolCalls);
      }, connectMemoryMcp);
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
    } else if (body.api_key?.trim()) headers.authorization = `Bearer ${body.api_key.trim()}`;
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
      }, connectMemoryMcp);
    });
    queueTurn(turn);
    try {
      await turn;
    } catch (error) {
      request.log.error(error);
      reply.raw.write(sseEvent("error", { detail: error instanceof Error ? error.message : "agent_request_failed" }));
    } finally { reply.raw.end(); }
  });
}
