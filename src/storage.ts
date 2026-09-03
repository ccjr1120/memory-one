import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

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

const now = () => new Date().toISOString();

export class MemoryStore {
  private readonly db: Database.Database;

  constructor(path = process.env.MEMORY_DB_PATH ?? "data/memory.db") {
    mkdirSync(dirname(path), { recursive: true });
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
        deleted_at TEXT
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
    this.rebuildFtsIfNeeded();
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
    let rows = project
      ? this.db.prepare("SELECT m.*, bm25(memories_fts) AS score FROM memories_fts JOIN memories m ON m.rowid = memories_fts.rowid WHERE memories_fts MATCH ? AND m.scope = ? AND m.project = ? AND m.deleted_at IS NULL ORDER BY score LIMIT ?").all(query, scope, project, max)
      : this.db.prepare("SELECT m.*, bm25(memories_fts) AS score FROM memories_fts JOIN memories m ON m.rowid = memories_fts.rowid WHERE memories_fts MATCH ? AND m.scope = ? AND m.deleted_at IS NULL ORDER BY score LIMIT ?").all(query, scope, max);
    if (!rows.length) {
      rows = project
        ? this.db.prepare("SELECT * FROM memories WHERE content LIKE ? AND scope = ? AND project = ? AND deleted_at IS NULL ORDER BY COALESCE(occurred_at, created_at) DESC LIMIT ?").all(`%${query}%`, scope, project, max)
        : this.db.prepare("SELECT * FROM memories WHERE content LIKE ? AND scope = ? AND deleted_at IS NULL ORDER BY COALESCE(occurred_at, created_at) DESC LIMIT ?").all(`%${query}%`, scope, max);
    }
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
}
