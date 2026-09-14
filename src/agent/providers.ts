import type { AgentChatRequest, AgentEvent, ProviderMessage } from "./types.js";

export async function readSse(response: Response, onEvent: (event: { event: string; data: string }) => Promise<boolean | void> | boolean | void) {
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
      if (data && await onEvent({ event, data }) === false) {
        await reader.cancel().catch(() => undefined);
        return;
      }
    }
    if (done) break;
  }
}

export function normalizeTools(tools: Array<{ name: string; description?: string; inputSchema: Record<string, unknown> }>) {
  return tools.map((tool) => ({ type: "function", function: { name: tool.name, description: tool.description ?? "", parameters: tool.inputSchema } }));
}

export async function openAiRound(config: AgentChatRequest, messages: ProviderMessage[], tools: unknown[], emit: (event: AgentEvent) => void) {
  const base = (config.base_url?.trim() || "").replace(/\/$/, "");
  const response = await fetch(`${base}/chat/completions`, { method: "POST", headers: { "content-type": "application/json", ...(config.api_key ? { authorization: `Bearer ${config.api_key}` } : {}) }, body: JSON.stringify({ model: config.model || "", messages, tools, stream: true }) });
  if (!response.ok) throw new Error(`provider_http_${response.status}: ${await response.text()}`);
  let content = "";
  const calls = new Map<number, { id: string; name: string; arguments: string }>();
  await readSse(response, ({ data }) => {
    if (data === "[DONE]") return false;
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

export async function openAiResponsesRound(config: AgentChatRequest, messages: ProviderMessage[], tools: unknown[], emit: (event: AgentEvent) => void) {
  const base = (config.base_url?.trim() || "").replace(/\/$/, "");
  const system = messages.find((message) => message.role === "system")?.content;
  const response = await fetch(`${base}/responses`, { method: "POST", headers: { "content-type": "application/json", ...(config.api_key ? { authorization: `Bearer ${config.api_key}` } : {}) }, body: JSON.stringify({ model: config.model || "", instructions: system, input: responsesInput(messages), tools: (tools as Array<any>).map((tool) => ({ type: "function", name: tool.function.name, description: tool.function.description, parameters: tool.function.parameters })), stream: false }) });
  if (!response.ok) throw new Error(`provider_http_${response.status}: ${await response.text()}`);
  const payload = await response.json() as any;
  let content = "";
  const toolCalls: Array<{ id: string; name: string; arguments: string }> = [];
  for (const item of payload.output ?? []) {
    if (item.type === "message") for (const part of item.content ?? []) if (part.type === "output_text" && part.text) content += part.text;
    if (item.type === "function_call") toolCalls.push({ id: item.call_id || item.id, name: item.name, arguments: item.arguments || "{}" });
  }
  if (content) emit({ type: "delta", text: content });
  return { content, toolCalls };
}

export async function anthropicRound(config: AgentChatRequest, messages: ProviderMessage[], tools: unknown[], emit: (event: AgentEvent) => void) {
  const base = (config.base_url?.trim() || "").replace(/\/$/, "");
  const system = messages.find((message) => message.role === "system")?.content;
  const response = await fetch(`${base}/messages`, { method: "POST", headers: { "content-type": "application/json", "anthropic-version": "2023-06-01", ...(config.api_key ? { "x-api-key": config.api_key } : {}) }, body: JSON.stringify({ model: config.model || "claude-3-5-sonnet-latest", max_tokens: 4096, system, messages: messages.filter((message) => message.role !== "system"), tools: (tools as Array<any>).map((tool) => ({ name: tool.function.name, description: tool.function.description, input_schema: tool.function.parameters })), stream: true }) });
  if (!response.ok) throw new Error(`provider_http_${response.status}: ${await response.text()}`);
  let content = "";
  const calls: Array<{ id: string; name: string; arguments: string }> = [];
  let current: any = null;
  await readSse(response, ({ event, data }) => {
    if (event === "message_stop") return false;
    const item = JSON.parse(data);
    if (event === "content_block_start" && item.content_block?.type === "tool_use") { current = { id: item.content_block.id, name: item.content_block.name, arguments: "" }; calls.push(current); }
    if (event === "content_block_delta") {
      if (item.delta?.type === "text_delta") { content += item.delta.text; emit({ type: "delta", text: item.delta.text }); }
      if (item.delta?.type === "input_json_delta" && current) current.arguments += item.delta.partial_json;
    }
  });
  return { content, toolCalls: calls };
}
