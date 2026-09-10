import Database from "better-sqlite3";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createHash, randomBytes, randomUUID } from "node:crypto";

export type MemoryInput = {
  id?: string;
  content: string;
  kind?: string;
  scope?: string;
  project?: string | null;
  session_id?: string | null;
  source?: string | null;
  occurred_at?: string | null;
  confidence?: number;
  importance?: number;
  metadata?: Record<string, unknown> | null;
};

export type Memory = Omit<MemoryInput, "metadata"> & {
  id: string;
  kind: string;
  scope: string;
  confidence: number;
  importance: number;
  metadata: Record<string, unknown>;
  embedding: Buffer | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  recall_count: number;
  last_recalled_at: string | null;
  score?: number;
};

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
  is_default: boolean;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

export type AppLanguage = "zh" | "en";

export type AppConfig = {
  language: AppLanguage | null;
  updated_at: string | null;
};

export type AgentConfig = {
  name: string;
  scope: string;
  provider: string;
  model: string;
  base_url: string;
  api_key: string;
  auto_context: boolean;
  updated_at: string | null;
};

const now = () => new Date().toISOString();

const searchStopWords = new Set([
  "以及", "然后", "但是", "因为", "所以", "这个", "那个", "如何", "需要", "进行", "相关", "当前",
  "设计", "结合", "传入", "版本", "不依赖", "机制", "问题", "实现", "一下", "一下子",
]);

function searchTerms(query: string): string[] {
  const terms = new Set<string>();
  const add = (term: string) => {
    const value = term.trim();
    if (!value || searchStopWords.has(value)) return;
    terms.add(value);
  };

  for (const match of query.replace(/[\r\n]+/g, " ").matchAll(/[A-Za-z][A-Za-z0-9_-]*|[\u4e00-\u9fff]{2,}/g)) {
    const value = match[0];
    if (/^[\u4e00-\u9fff]+$/.test(value) && value.length > 4) {
      add(value);
      for (let index = 0; index < value.length - 1; index += 2) add(value.slice(index, index + 2));
    } else {
      add(value);
    }
  }
  return [...terms].slice(0, 16);
}

const quoteFtsTerm = (term: string) => `"${term.replaceAll('"', '""')}"`;
const likeScore = (terms: string[], alias = "m") => terms.map((_, index) => `CASE WHEN ${alias}.content LIKE @pattern${index} THEN 1 ELSE 0 END`).join(" + ") || "0";
const likeWhere = (terms: string[], alias = "m") => terms.map((_, index) => `${alias}.content LIKE @pattern${index}`).join(" OR ") || "0";
const likeParams = (terms: string[]) => Object.fromEntries(terms.map((term, index) => [`pattern${index}`, `%${term}%`]));

export class MemoryStore {
  private readonly db: Database.Database;
  private readonly languageFile: string;

  constructor(path = process.env.MEMORY_DB_PATH ?? "data/memory.db") {
    mkdirSync(dirname(path), { recursive: true });
    this.languageFile = join(dirname(path), "language");
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("busy_timeout = 5000");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'fact',
        scope TEXT NOT NULL DEFAULT 'user',
        project TEXT,
        session_id TEXT,
        source TEXT,
        occurred_at TEXT,
        confidence REAL NOT NULL DEFAULT 1.0,
        importance REAL NOT NULL DEFAULT 0.5,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        embedding BLOB,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        recall_count INTEGER NOT NULL DEFAULT 0,
        last_recalled_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_memories_scope ON memories(scope, project);
      CREATE INDEX IF NOT EXISTS idx_memories_session ON memories(session_id);
      CREATE INDEX IF NOT EXISTS idx_memories_occurred ON memories(occurred_at);
      CREATE TABLE IF NOT EXISTS mcp_tool_calls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tool_name TEXT NOT NULL,
        success INTEGER NOT NULL,
        duration_ms REAL NOT NULL,
        called_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_mcp_tool_calls_tool ON mcp_tool_calls(tool_name);
      CREATE INDEX IF NOT EXISTS idx_mcp_tool_calls_called_at ON mcp_tool_calls(called_at);
      CREATE TABLE IF NOT EXISTS mcp_keys (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        prefix TEXT NOT NULL,
        key_hash TEXT NOT NULL UNIQUE,
        allowed_tools_json TEXT NOT NULL DEFAULT '[]',
        is_default INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        last_used_at TEXT,
        revoked_at TEXT
      );
      CREATE TABLE IF NOT EXISTS agent_config (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        name TEXT NOT NULL DEFAULT '记忆管家',
        scope TEXT NOT NULL DEFAULT '',
        provider TEXT NOT NULL DEFAULT '',
        model TEXT NOT NULL DEFAULT '',
        base_url TEXT NOT NULL DEFAULT '',
        api_key TEXT NOT NULL DEFAULT '',
        auto_context INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT
      );
      CREATE TABLE IF NOT EXISTS agent_messages (
        id TEXT PRIMARY KEY,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL DEFAULT '',
        tool_calls_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_agent_messages_created ON agent_messages(created_at);
      CREATE TABLE IF NOT EXISTS agent_executions (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
        message_ids_json TEXT NOT NULL DEFAULT '[]',
        error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_agent_executions_created ON agent_executions(created_at);
      CREATE TABLE IF NOT EXISTS agent_execution_events (
        execution_id TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        type TEXT NOT NULL,
        data_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        PRIMARY KEY (execution_id, sequence),
        FOREIGN KEY (execution_id) REFERENCES agent_executions(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_agent_execution_events_created ON agent_execution_events(execution_id, sequence);
      CREATE TABLE IF NOT EXISTS mcp_config (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        use_bearer_key INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT
      );
      CREATE TABLE IF NOT EXISTS app_config (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        language TEXT NOT NULL CHECK (language IN ('zh', 'en')),
        updated_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_mcp_keys_active ON mcp_keys(revoked_at);
      CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
        content, kind, scope, project, source, content='memories', content_rowid='rowid'
      );
      CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
        INSERT INTO memories_fts(rowid, content, kind, scope, project, source)
        VALUES (new.rowid, new.content, new.kind, new.scope, new.project, new.source);
      END;
      CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
        INSERT INTO memories_fts(memories_fts, rowid, content, kind, scope, project, source)
        VALUES ('delete', old.rowid, old.content, old.kind, old.scope, old.project, old.source);
      END;
      CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
        INSERT INTO memories_fts(memories_fts, rowid, content, kind, scope, project, source)
        VALUES ('delete', old.rowid, old.content, old.kind, old.scope, old.project, old.source);
        INSERT INTO memories_fts(rowid, content, kind, scope, project, source)
        VALUES (new.rowid, new.content, new.kind, new.scope, new.project, new.source);
      END;
    `);
    const columns = this.db.prepare("PRAGMA table_info(memories)").all() as Array<{ name: string }>;
    if (!columns.some((column) => column.name === "recall_count")) this.db.exec("ALTER TABLE memories ADD COLUMN recall_count INTEGER NOT NULL DEFAULT 0");
    if (!columns.some((column) => column.name === "last_recalled_at")) this.db.exec("ALTER TABLE memories ADD COLUMN last_recalled_at TEXT");
    const keyColumns = this.db.prepare("PRAGMA table_info(mcp_keys)").all() as Array<{ name: string }>;
    if (!keyColumns.some((column) => column.name === "is_default")) this.db.exec("ALTER TABLE mcp_keys ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0");
    if (!keyColumns.some((column) => column.name === "secret")) this.db.exec("ALTER TABLE mcp_keys ADD COLUMN secret TEXT");
    const existingLanguage = this.getAppConfig().language;
    if (!existingLanguage) {
      try {
        const storedLanguage = readFileSync(this.languageFile, "utf8").trim();
        if (storedLanguage === "zh" || storedLanguage === "en") this.saveAppConfig(storedLanguage);
      } catch {}
      const environmentLanguage = process.env.MEMORY_LANGUAGE;
      if (!this.getAppConfig().language && (environmentLanguage === "zh" || environmentLanguage === "en")) this.saveAppConfig(environmentLanguage);
    }
    this.rebuildFtsIfNeeded();
  }

  listAgentMessages(limit = 200) {
    return (this.db.prepare("SELECT id, role, content, tool_calls_json, created_at, updated_at FROM agent_messages ORDER BY created_at ASC LIMIT ?").all(Math.min(Math.max(limit, 1), 1000)) as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id), role: row.role as "user" | "assistant", content: String(row.content ?? ""), toolCalls: JSON.parse(String(row.tool_calls_json ?? "[]")), created_at: String(row.created_at), updated_at: String(row.updated_at),
    }));
  }

  saveAgentMessage(message: { id: string; role: "user" | "assistant"; content: string; toolCalls?: unknown[] }) {
    const timestamp = now();
    this.db.prepare(`INSERT INTO agent_messages (id, role, content, tool_calls_json, created_at, updated_at) VALUES (@id, @role, @content, @tool_calls_json, @created_at, @updated_at)
      ON CONFLICT(id) DO UPDATE SET content = excluded.content, tool_calls_json = excluded.tool_calls_json, updated_at = excluded.updated_at`).run({ id: message.id, role: message.role, content: message.content, tool_calls_json: JSON.stringify(message.toolCalls ?? []), created_at: timestamp, updated_at: timestamp });
    return this.listAgentMessages(1000).find((item) => item.id === message.id);
  }

  createAgentExecution(input: { id?: string; messageIds?: string[] } = {}) {
    const id = input.id ?? randomUUID();
    const timestamp = now();
    this.db.prepare(`INSERT INTO agent_executions (id, status, message_ids_json, error, created_at, updated_at)
      VALUES (@id, 'running', @message_ids_json, NULL, @created_at, @updated_at)`).run({ id, message_ids_json: JSON.stringify(input.messageIds ?? []), created_at: timestamp, updated_at: timestamp });
    return this.getAgentExecution(id);
  }

  appendAgentExecutionEvent(executionId: string, type: string, data: unknown = {}) {
    const row = this.db.prepare("SELECT COALESCE(MAX(sequence), 0) AS sequence FROM agent_execution_events WHERE execution_id = ?").get(executionId) as { sequence: number };
    const sequence = Number(row.sequence) + 1;
    const timestamp = now();
    this.db.prepare("INSERT INTO agent_execution_events (execution_id, sequence, type, data_json, created_at) VALUES (?, ?, ?, ?, ?)").run(executionId, sequence, type, JSON.stringify(data), timestamp);
    return { id: sequence, execution_id: executionId, type, data, created_at: timestamp };
  }

  listAgentExecutionEvents(executionId: string, afterSequence = 0) {
    return (this.db.prepare("SELECT sequence, type, data_json, created_at FROM agent_execution_events WHERE execution_id = ? AND sequence > ? ORDER BY sequence ASC").all(executionId, Math.max(0, afterSequence)) as Array<Record<string, unknown>>).map((row) => ({ id: Number(row.sequence), execution_id: executionId, type: String(row.type), data: JSON.parse(String(row.data_json ?? "{}")), created_at: String(row.created_at) }));
  }

  getAgentExecution(id: string) {
    const row = this.db.prepare("SELECT * FROM agent_executions WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return { id: String(row.id), status: String(row.status), messageIds: JSON.parse(String(row.message_ids_json ?? "[]")), error: row.error ? String(row.error) : null, created_at: String(row.created_at), updated_at: String(row.updated_at), messages: this.listAgentMessages(1000).filter((message) => (JSON.parse(String(row.message_ids_json ?? "[]")) as string[]).includes(message.id)) };
  }

  updateAgentExecution(id: string, patch: { status?: "running" | "completed" | "failed" | "cancelled"; messageIds?: string[]; error?: string | null }) {
    const current = this.getAgentExecution(id);
    if (!current) return null;
    const timestamp = now();
    this.db.prepare(`UPDATE agent_executions SET status = COALESCE(@status, status), message_ids_json = COALESCE(@message_ids_json, message_ids_json), error = @error, updated_at = @updated_at WHERE id = @id`).run({ id, status: patch.status ?? null, message_ids_json: patch.messageIds ? JSON.stringify(patch.messageIds) : null, error: patch.error === undefined ? current.error : patch.error, updated_at: timestamp });
    return this.getAgentExecution(id);
  }

  listAgentExecutions(limit = 50) {
    return (this.db.prepare("SELECT id FROM agent_executions ORDER BY created_at DESC LIMIT ?").all(Math.min(Math.max(limit, 1), 200)) as Array<{ id: string }>).map((row) => this.getAgentExecution(row.id)).filter(Boolean);
  }

  private rebuildFtsIfNeeded() {
    const count = this.db.prepare("SELECT count(*) AS count FROM memories_fts").get() as { count: number };
    const memories = this.db.prepare("SELECT count(*) AS count FROM memories").get() as { count: number };
    if (count.count !== memories.count) this.db.exec("INSERT INTO memories_fts(memories_fts) VALUES ('rebuild')");
  }

  private decode(row: Record<string, unknown>): Memory {
    const { metadata_json, ...rest } = row;
    return { ...rest, metadata: JSON.parse(String(metadata_json ?? "{}")) } as Memory;
  }

  create(input: MemoryInput): Memory {
    const id = input.id ?? randomUUID();
    const timestamp = now();
    this.db.prepare(`INSERT INTO memories
      (id, content, kind, scope, project, session_id, source, occurred_at, confidence, importance, metadata_json, created_at, updated_at)
      VALUES (@id, @content, @kind, @scope, @project, @session_id, @source, @occurred_at, @confidence, @importance, @metadata_json, @created_at, @updated_at)`)
      .run({
        id, content: input.content, kind: input.kind ?? "fact", scope: input.scope ?? "user",
        project: input.project ?? null, session_id: input.session_id ?? null, source: input.source ?? null,
        occurred_at: input.occurred_at ?? null, confidence: input.confidence ?? 1.0, importance: input.importance ?? 0.5,
        metadata_json: JSON.stringify(input.metadata ?? {}), created_at: timestamp, updated_at: timestamp,
      });
    return this.get(id)!;
  }

  get(id: string): Memory | null {
    const row = this.db.prepare("SELECT * FROM memories WHERE id = ? AND deleted_at IS NULL").get(id) as Record<string, unknown> | undefined;
    return row ? this.decode(row) : null;
  }

  list(scope = "user", project: string | null = null, limit = 50): Memory[] {
    const rows = project
      ? this.db.prepare("SELECT * FROM memories WHERE scope = ? AND project = ? AND deleted_at IS NULL ORDER BY COALESCE(occurred_at, created_at) DESC LIMIT ?").all(scope, project, Math.min(Math.max(limit, 1), 200))
      : this.db.prepare("SELECT * FROM memories WHERE scope = ? AND deleted_at IS NULL ORDER BY COALESCE(occurred_at, created_at) DESC LIMIT ?").all(scope, Math.min(Math.max(limit, 1), 200));
    return (rows as Record<string, unknown>[]).map((row) => this.decode(row));
  }

  search(query: string, scope = "user", project: string | null = null, limit = 20): Memory[] {
    const max = Math.min(Math.max(limit, 1), 100);
    const terms = searchTerms(query);
    const ftsQuery = terms.map(quoteFtsTerm).join(" OR ");
    let rows: unknown[] = [];
    try {
      if (!ftsQuery) throw new Error("empty_search_query");
      rows = (project
        ? this.db.prepare("SELECT m.*, bm25(memories_fts) AS score FROM memories_fts JOIN memories m ON m.rowid = memories_fts.rowid WHERE memories_fts MATCH ? AND m.scope = ? AND m.project = ? AND m.deleted_at IS NULL ORDER BY score LIMIT ?").all(ftsQuery, scope, project, max)
        : this.db.prepare("SELECT m.*, bm25(memories_fts) AS score FROM memories_fts JOIN memories m ON m.rowid = memories_fts.rowid WHERE memories_fts MATCH ? AND m.scope = ? AND m.deleted_at IS NULL ORDER BY score LIMIT ?").all(ftsQuery, scope, max)) as unknown[];
    } catch {
      rows = [];
    }
    if (!rows.length) {
      const params = { scope, project, limit: max, ...likeParams(terms) };
      rows = terms.length
        ? project
          ? this.db.prepare(`SELECT m.* FROM memories m WHERE (${likeWhere(terms)}) AND m.scope = @scope AND m.project = @project AND m.deleted_at IS NULL ORDER BY ${likeScore(terms)} DESC, COALESCE(m.occurred_at, m.created_at) DESC LIMIT @limit`).all(params)
          : this.db.prepare(`SELECT m.* FROM memories m WHERE (${likeWhere(terms)}) AND m.scope = @scope AND m.deleted_at IS NULL ORDER BY ${likeScore(terms)} DESC, COALESCE(m.occurred_at, m.created_at) DESC LIMIT @limit`).all(params)
        : [];
    }
    return (rows as Record<string, unknown>[]).map((row) => this.decode(row));
  }

  context(query: string | null, scope = "user", project: string | null = null, limit = 10): Memory[] {
    const max = Math.min(Math.max(limit, 1), 100);
    const projectFilter = project ? "(m.project = @project OR m.project IS NULL)" : "m.project IS NULL";
    const terms = query ? searchTerms(query) : [];
    const ftsQuery = terms.map(quoteFtsTerm).join(" OR ");
    const params = { query: ftsQuery, scope, project, limit: max, ...likeParams(terms) };
    const persistentRows = this.db.prepare(`SELECT m.* FROM memories m
      WHERE m.scope = @scope AND ${projectFilter} AND m.kind = 'preference' AND m.deleted_at IS NULL
        AND json_extract(m.metadata_json, '$.always_include') = 1
      ORDER BY CASE WHEN m.project = @project THEN 0 ELSE 1 END, m.importance DESC, COALESCE(m.occurred_at, m.created_at) DESC LIMIT @limit`).all(params) as Record<string, unknown>[];
    const persistentIds = new Set(persistentRows.map((row) => String(row.id)));
    const relevantLimit = Math.max(0, max - persistentRows.length);
    let rows: unknown[] = [];
    if (relevantLimit && ftsQuery) {
      const relevantParams = { ...params, limit: relevantLimit };
      try {
        rows = this.db.prepare(`SELECT m.*, bm25(memories_fts) AS score
          FROM memories_fts JOIN memories m ON m.rowid = memories_fts.rowid
          WHERE memories_fts MATCH @query AND m.scope = @scope AND ${projectFilter} AND m.deleted_at IS NULL
            AND NOT (m.kind = 'preference' AND json_extract(m.metadata_json, '$.always_include') = 1)
          ORDER BY CASE WHEN m.project = @project THEN 0 ELSE 1 END, score LIMIT @limit`).all(relevantParams) as unknown[];
      } catch {
        rows = [];
      }
      if (!rows.length) {
        rows = this.db.prepare(`SELECT m.* FROM memories m
          WHERE (${likeWhere(terms)}) AND m.scope = @scope AND ${projectFilter} AND m.deleted_at IS NULL
            AND NOT (m.kind = 'preference' AND json_extract(m.metadata_json, '$.always_include') = 1)
          ORDER BY CASE WHEN m.project = @project THEN 0 ELSE 1 END, ${likeScore(terms)} DESC, COALESCE(m.occurred_at, m.created_at) DESC LIMIT @limit`)
          .all(relevantParams) as unknown[];
      }
    } else if (relevantLimit && !ftsQuery) {
      rows = this.db.prepare(`SELECT m.* FROM memories m
        WHERE m.scope = @scope AND ${projectFilter} AND m.deleted_at IS NULL
          AND NOT (m.kind = 'preference' AND json_extract(m.metadata_json, '$.always_include') = 1)
        ORDER BY CASE WHEN m.project = @project THEN 0 ELSE 1 END, COALESCE(m.occurred_at, m.created_at) DESC LIMIT @limit`).all({ ...params, limit: relevantLimit }) as unknown[];
    }
    const relevantRows = (rows as Record<string, unknown>[]).filter((row) => !persistentIds.has(String(row.id)));
    return [...persistentRows, ...relevantRows].slice(0, max).map((row) => this.decode(row));
  }

  recordRecalls(memories: Memory[]): Memory[] {
    if (!memories.length) return memories;
    const timestamp = now();
    const update = this.db.prepare("UPDATE memories SET recall_count = recall_count + 1, last_recalled_at = ? WHERE id = ? AND deleted_at IS NULL");
    const ids = [...new Set(memories.map((memory) => memory.id))];
    this.db.transaction(() => { for (const id of ids) update.run(timestamp, id); })();
    return memories.map((memory) => ({ ...memory, recall_count: (memory.recall_count ?? 0) + 1, last_recalled_at: timestamp }));
  }

  mostRecalled(scope = "user", project: string | null = null, limit = 5): Memory[] {
    const max = Math.min(Math.max(limit, 1), 50);
    const rows = project
      ? this.db.prepare("SELECT * FROM memories WHERE scope = ? AND project = ? AND deleted_at IS NULL ORDER BY recall_count DESC, last_recalled_at DESC, created_at DESC LIMIT ?").all(scope, project, max)
      : this.db.prepare("SELECT * FROM memories WHERE scope = ? AND deleted_at IS NULL ORDER BY recall_count DESC, last_recalled_at DESC, created_at DESC LIMIT ?").all(scope, max);
    return (rows as Record<string, unknown>[]).map((row) => this.decode(row));
  }

  update(id: string, patch: Partial<MemoryInput>): Memory | null {
    const allowed = ["content", "kind", "scope", "project", "session_id", "source", "occurred_at", "confidence", "importance"] as const;
    const values: Record<string, unknown> = {};
    for (const key of allowed) if (key in patch) values[key] = patch[key];
    if ("metadata" in patch) values.metadata_json = JSON.stringify(patch.metadata ?? {});
    const entries = Object.entries(values);
    if (!entries.length) return this.get(id);
    values.updated_at = now();
    this.db.prepare(`UPDATE memories SET ${Object.keys(values).map((key) => `${key} = @${key}`).join(", ")} WHERE id = @id AND deleted_at IS NULL`).run({ ...values, id });
    return this.get(id);
  }

  delete(id: string): boolean {
    const result = this.db.prepare("UPDATE memories SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL").run(now(), now(), id);
    return result.changes > 0;
  }


  recordToolCall(toolName: string, success: boolean, durationMs: number): void {
    this.db.prepare("INSERT INTO mcp_tool_calls (tool_name, success, duration_ms, called_at) VALUES (?, ?, ?, ?)")
      .run(toolName, success ? 1 : 0, durationMs, now());
  }

  getToolStats(): McpToolStats {
    const totals = this.db.prepare(`SELECT
      count(*) AS total_calls,
      coalesce(sum(success), 0) AS successful_calls,
      count(*) - coalesce(sum(success), 0) AS failed_calls,
      coalesce(round(avg(duration_ms), 2), 0) AS average_duration_ms,
      max(called_at) AS last_called_at
      FROM mcp_tool_calls`).get() as Omit<McpToolStats, "tools">;
    const tools = this.db.prepare(`SELECT
      tool_name,
      count(*) AS calls,
      coalesce(sum(success), 0) AS successful_calls,
      count(*) - coalesce(sum(success), 0) AS failed_calls,
      coalesce(round(avg(duration_ms), 2), 0) AS average_duration_ms,
      max(called_at) AS last_called_at
      FROM mcp_tool_calls
      GROUP BY tool_name
      ORDER BY calls DESC, tool_name ASC`).all() as McpToolStats["tools"];
    return { ...totals, tools };
  }

  createMcpKey(name: string, allowedTools: string[], isDefault = false) {
    const id = randomUUID();
    const secret = `mo_${randomBytes(24).toString("base64url")}`;
    const timestamp = now();
    this.db.prepare("INSERT INTO mcp_keys (id, name, prefix, key_hash, secret, allowed_tools_json, is_default, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id, name, secret.slice(0, 11), createHash("sha256").update(secret).digest("hex"), secret, JSON.stringify(allowedTools), isDefault ? 1 : 0, timestamp);
    return { key: secret, keyRecord: this.getMcpKey(id)! };
  }

  getMcpKey(id: string): McpKey | null {
    const row = this.db.prepare("SELECT id, name, prefix, secret, allowed_tools_json, is_default, created_at, last_used_at, revoked_at FROM mcp_keys WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    const { allowed_tools_json, is_default, ...rest } = row;
    return { ...rest, is_default: Boolean(is_default), allowed_tools: JSON.parse(String(allowed_tools_json ?? "[]")) } as McpKey;
  }

  listMcpKeys(): McpKey[] {
    return (this.db.prepare("SELECT id, name, prefix, secret, allowed_tools_json, is_default, created_at, last_used_at, revoked_at FROM mcp_keys WHERE revoked_at IS NULL ORDER BY created_at DESC").all() as Record<string, unknown>[]).map((row) => { const { allowed_tools_json, is_default, ...rest } = row; return { ...rest, is_default: Boolean(is_default), allowed_tools: JSON.parse(String(allowed_tools_json ?? "[]")) } as McpKey; });
  }

  updateMcpKey(id: string, patch: { name?: string; allowed_tools?: string[] }): McpKey | null {
    const values: Record<string, unknown> = {};
    if (patch.name !== undefined) values.name = patch.name;
    if (patch.allowed_tools !== undefined) values.allowed_tools_json = JSON.stringify(patch.allowed_tools);
    if (!Object.keys(values).length) return this.getMcpKey(id);
    this.db.prepare(`UPDATE mcp_keys SET ${Object.keys(values).map((key) => `${key} = @${key}`).join(", ")} WHERE id = @id AND revoked_at IS NULL`).run({ ...values, id });
    return this.getMcpKey(id);
  }

  revokeMcpKey(id: string): boolean {
    return this.db.prepare("DELETE FROM mcp_keys WHERE id = ?").run(id).changes > 0;
  }

  verifyMcpKey(secret: string): McpKey | null {
    const hash = createHash("sha256").update(secret).digest("hex");
    const row = this.db.prepare("SELECT id, name, prefix, allowed_tools_json, is_default, created_at, last_used_at, revoked_at FROM mcp_keys WHERE key_hash = ? AND revoked_at IS NULL").get(hash) as Record<string, unknown> | undefined;
    if (!row) return null;
    this.db.prepare("UPDATE mcp_keys SET last_used_at = ? WHERE id = ?").run(now(), row.id);
    const { allowed_tools_json, is_default, ...rest } = row;
    return { ...rest, is_default: Boolean(is_default), allowed_tools: JSON.parse(String(allowed_tools_json ?? "[]")) } as McpKey;
  }

  getAgentConfig(): AgentConfig {
    const row = this.db.prepare("SELECT name, scope, provider, model, base_url, api_key, auto_context, updated_at FROM agent_config WHERE id = 1").get() as Record<string, unknown> | undefined;
    if (!row) return { name: "记忆管家", scope: "", provider: "", model: "", base_url: "", api_key: "", auto_context: true, updated_at: null };
    return { ...row, auto_context: Boolean(row.auto_context) } as AgentConfig;
  }


  getAppConfig(): AppConfig {
    const row = this.db.prepare("SELECT language, updated_at FROM app_config WHERE id = 1").get() as Record<string, unknown> | undefined;
    if (!row) return { language: null, updated_at: null };
    return { language: row.language === "en" ? "en" : "zh", updated_at: String(row.updated_at ?? "") || null };
  }

  saveAppConfig(language: AppLanguage): AppConfig {
    const updatedAt = now();
    this.db.prepare(`INSERT INTO app_config (id, language, updated_at) VALUES (1, @language, @updated_at)
      ON CONFLICT(id) DO UPDATE SET language = excluded.language, updated_at = excluded.updated_at`).run({ language, updated_at: updatedAt });
    writeFileSync(this.languageFile, `${language}\n`, "utf8");
    return this.getAppConfig();
  }

  getMcpConfig(): { use_bearer_key: boolean; updated_at: string | null } {
    const row = this.db.prepare("SELECT use_bearer_key, updated_at FROM mcp_config WHERE id = 1").get() as Record<string, unknown> | undefined;
    return { use_bearer_key: row ? Boolean(row.use_bearer_key) : true, updated_at: row ? String(row.updated_at ?? "") || null : null };
  }

  saveMcpConfig(useBearerKey: boolean) {
    const updatedAt = now();
    this.db.prepare(`INSERT INTO mcp_config (id, use_bearer_key, updated_at) VALUES (1, @use_bearer_key, @updated_at)
      ON CONFLICT(id) DO UPDATE SET use_bearer_key = excluded.use_bearer_key, updated_at = excluded.updated_at`).run({ use_bearer_key: useBearerKey ? 1 : 0, updated_at: updatedAt });
    return this.getMcpConfig();
  }

  saveAgentConfig(input: Partial<Omit<AgentConfig, "updated_at">>): AgentConfig {
    const current = this.getAgentConfig();
    const next = {
      name: input.name?.trim() || current.name,
      scope: input.scope?.trim() ?? current.scope,
      provider: input.provider?.trim() || current.provider,
      model: input.model?.trim() ?? current.model,
      base_url: input.base_url?.trim() ?? current.base_url,
      api_key: input.api_key?.trim() ?? current.api_key,
      auto_context: input.auto_context ?? current.auto_context,
      updated_at: now(),
    };
    this.db.prepare(`INSERT INTO agent_config (id, name, scope, provider, model, base_url, api_key, auto_context, updated_at)
      VALUES (1, @name, @scope, @provider, @model, @base_url, @api_key, @auto_context, @updated_at)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, scope = excluded.scope, provider = excluded.provider,
        model = excluded.model, base_url = excluded.base_url, api_key = excluded.api_key,
        auto_context = excluded.auto_context, updated_at = excluded.updated_at`).run({ ...next, auto_context: next.auto_context ? 1 : 0 });
    return this.getAgentConfig();
  }
}
