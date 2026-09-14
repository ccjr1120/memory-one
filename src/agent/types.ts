export type AgentToolCall = { name: string; label: string; count?: number };
export type AgentChatRequest = {
  message?: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  provider?: string;
  model?: string;
  base_url?: string | null;
  api_key?: string | null;
  scope?: string | null;
  auto_context?: boolean;
  user_message_id?: string;
  assistant_message_id?: string;
};
export type AgentEvent = { type: "delta"; text: string } | { type: "tool"; tool: AgentToolCall } | { type: "done"; toolCalls: AgentToolCall[] };
export type ProviderMessage = Record<string, unknown>;
export type MemoryMcpConnector = () => Promise<{
  client: {
    listTools(): Promise<{ tools: Array<{ name: string; description?: string; inputSchema: Record<string, unknown> }> }>;
    callTool(request: { name: string; arguments: unknown }, schema: unknown): Promise<unknown>;
  };
  transport: { close(): Promise<void> };
}>;
