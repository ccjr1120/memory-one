export type Language = "zh" | "en";

export type Memory = {
  id: string;
  content: string;
  kind: string;
  scope: string;
  project?: string | null;
  source?: string | null;
  occurred_at?: string | null;
  created_at: string;
  updated_at: string;
  confidence: number;
  importance: number;
  recall_count: number;
  last_recalled_at?: string | null;
  content_hash?: string | null;
  supersedes_id?: string | null;
  superseded_by?: string | null;
  metadata: Record<string, unknown>;
};

export type RecallEvent = {
  id: number;
  memory_id?: string;
  source: string;
  query: string | null;
  created_at: string;
  content?: string;
};

export type DataImportResult = { imported: number; skipped: number; mode: "merge" | "replace" };

export type McpToolStats = {
  total_calls: number;
  successful_calls: number;
  failed_calls: number;
  average_duration_ms: number;
  last_called_at: string | null;
  tools: Array<{
    tool_name: string;
    calls: number;
    successful_calls: number;
    failed_calls: number;
    average_duration_ms: number;
    last_called_at: string;
  }>;
};

export type McpKey = {
  id: string;
  name: string;
  prefix: string;
  secret: string | null;
  allowed_tools: string[];
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

export type CodexIntegration = {
  path: string;
  status: "not_configured" | "configured" | "update_available";
};

export type CodexMcpIntegration = {
  path: string;
  detected: boolean;
  endpoint: string | null;
  auth_required: boolean;
  configured_key_id: string | null;
  status: "not_configured" | "configured" | "update_available";
};
