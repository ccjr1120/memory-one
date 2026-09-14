import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { anthropicRound, normalizeTools, openAiResponsesRound, openAiRound } from "./providers.js";
import type { AgentChatRequest, AgentEvent, AgentToolCall, MemoryMcpConnector, ProviderMessage } from "./types.js";

const agentSystemPrompt = "你是 Memory One 的记忆管家，首要职责是结合已读取的相关记忆直接回答用户的问题。你可以主动搜索和读取记忆来提高回答准确性，但不得因为普通对话、提问、纠正回答、顺带提到的偏好或项目细节而新增、更新或删除记忆。只有当用户明确要求‘记住/保存’某项内容、明确要求修改某条记忆，或明确要求‘忘记/删除’某条记忆时，才调用 memory_store、memory_update 或 memory_delete。执行更新或删除前先确认目标唯一，不要编造记忆。回复使用中文，简洁但可以使用 Markdown。";
const toolLabels: Record<string, string> = { "memory-get-context": "读取固定上下文", "memory-search": "搜索记忆", memory_get: "读取记忆", memory_list: "列出记忆", memory_store: "保存记忆", memory_update: "更新记忆", memory_delete: "删除记忆", memory_feedback: "记录反馈" };
const isMemoryOverviewRequest = (message: string) => /(?:有哪些|所有记忆|全部记忆|列出(?:全部)?|查看(?:全部)?|浏览全部|总结(?:下)?(?:我的)?记忆|总结我的特点|概括我的特点|我的画像|我的偏好和特点|我的记忆(?:有什么)?特点|记忆特点)/.test(message);

const parseMcpText = (value: unknown, fallback: unknown) => {
  const content = (value as { content?: Array<{ type: string; text?: string }> }).content;
  const text = content?.filter((item) => item.type === "text").map((item) => item.text ?? "").join("\n");
  if (!text) return fallback;
  try { return JSON.parse(text); } catch { return text; }
};

export async function runAgent(request: AgentChatRequest, emit: (event: AgentEvent) => void, connectMemoryMcp: MemoryMcpConnector) {
  const provider = (request.provider || "").toLowerCase();
  if (!request.message?.trim()) { emit({ type: "delta", text: "告诉我你想查找、保存、修改、删除，还是总结哪些记忆？" }); emit({ type: "done", toolCalls: [] }); return; }
  if (!["openai", "openai-compatible", "anthropic", "local"].includes(provider)) throw new Error("unsupported_provider");
  if (!request.base_url?.trim()) throw new Error("missing_base_url");
  if (provider !== "local" && !request.api_key) throw new Error("missing_api_key");
  const { client, transport } = await connectMemoryMcp();
  const toolResult = await client.listTools();
  const tools = normalizeTools(toolResult.tools);
  const toolCalls: AgentToolCall[] = [];
  const history = (request.history ?? []).slice(-12).filter((message) => message.content).map((message) => ({ role: message.role, content: message.content }));
  const messages: ProviderMessage[] = [{ role: "system", content: `${agentSystemPrompt}${request.scope ? ` 默认 Scope：${request.scope}` : ""}${request.auto_context === false ? " 不需要自动读取上下文。" : " 每个新任务开始时先调用 memory-get-context；后续如需具体历史信息，使用 memory-search。"}` }, ...history];
  if (!history.some((message) => message.role === "user" && message.content === request.message)) messages.push({ role: "user", content: request.message });
  try {
    if (request.auto_context !== false) {
      const overviewRequest = isMemoryOverviewRequest(request.message);
      const context = await client.callTool({ name: "memory-get-context", arguments: { scope: request.scope || null, limit: overviewRequest ? 50 : 10 } }, CallToolResultSchema);
      const contextText = JSON.stringify(parseMcpText(context, {}));
      const parsed = parseMcpText(context, {});
      toolCalls.push({ name: "memory-get-context", label: toolLabels["memory-get-context"], count: Array.isArray(parsed) ? parsed.length : parsed?.memories?.length });
      emit({ type: "tool", tool: toolCalls.at(-1)! });
      messages[0] = { role: "system", content: `${messages[0].content}\n\n已自动读取 memory-get-context，结果如下。请基于这些固定上下文回答；如需查找具体历史信息，请调用 memory-search，不要重复调用 memory-get-context：\n${contextText}` };
      if (overviewRequest) {
        const listed = await client.callTool({ name: "memory_list", arguments: { scope: request.scope || null, limit: 100 } }, CallToolResultSchema);
        const listedText = JSON.stringify(parseMcpText(listed, []));
        const listedParsed = parseMcpText(listed, []);
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
        if (request.scope && ["memory-get-context", "memory-search", "memory_list", "memory_store"].includes(call.name) && args.scope == null) args.scope = request.scope;
        if (request.scope && call.name === "memory_update" && args.patch && typeof args.patch === "object" && args.patch.scope == null) args.patch = { ...args.patch, scope: request.scope };
        const output = await client.callTool({ name: call.name, arguments: args }, CallToolResultSchema);
        const text = ((output as any).content as Array<{ type: string; text?: string }> | undefined)?.filter((item) => item.type === "text").map((item) => item.text ?? "").join("\n") || JSON.stringify(output);
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
