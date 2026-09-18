import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { MemoryStore } from "../storage.js";

const claudeConfigDir = process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude");
const claudeMcpConfigPath = process.env.CLAUDE_CONFIG_DIR
  ? join(claudeConfigDir, ".claude.json")
  : join(homedir(), ".claude.json");
const claudeAgentsPath = join(claudeConfigDir, "CLAUDE.md");
const claudeGuidanceStart = "<!-- memory-one:claude:start -->";
const claudeGuidanceEnd = "<!-- memory-one:claude:end -->";
const claudeGuidance = `${claudeGuidanceStart}
## Memory One

Before starting any new user task, call the Memory One MCP tool \`memory-get-context\` once to retrieve persistent context.

- When working in a project, resolve the Git repository root and pass its absolute directory path as \`scope\`. Use the same scope when storing project-specific memory; omit \`scope\` for general preferences and knowledge.
- Apply the returned persistent preferences and project conventions before planning, answering, editing files, or calling task-specific tools.
- If a \`memory-get-context\` result already exists in the current task conversation, do not call it again; use \`memory-search\` when a specific historical preference, decision, fact, or project convention is needed.
- Only save a memory when the user explicitly asks to remember or save it; if a durable preference, decision, project convention, personal fact, or correction seems worth keeping but the user did not ask, ask for confirmation instead. Use \`memory_update\` only after the user explicitly asks to change an existing memory. Do not save clearly transient, one-off details.
- Before storing, prefer updating or superseding a similar memory instead of creating a near-duplicate.
- Do not skip retrieval merely because the task appears self-contained.
${claudeGuidanceEnd}`;

type ClaudeMcpConfig = {
  mcpServers?: Record<string, { type?: string; url?: string; headers?: Record<string, string> }>;
  [key: string]: unknown;
};

async function readClaudeAgents() {
  try {
    return await readFile(claudeAgentsPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw error;
  }
}

function removeManagedClaudeGuidance(content: string) {
  const start = content.indexOf(claudeGuidanceStart);
  const end = content.indexOf(claudeGuidanceEnd, start + claudeGuidanceStart.length);
  if (start < 0 || end < 0) return content;
  const before = content.slice(0, start).trimEnd();
  const after = content.slice(end + claudeGuidanceEnd.length).trimStart();
  return [before, after].filter(Boolean).join("\n\n");
}

async function readClaudeConfig(): Promise<{ content: string; config: ClaudeMcpConfig }> {
  try {
    const content = await readFile(claudeMcpConfigPath, "utf8");
    return { content, config: JSON.parse(content) as ClaudeMcpConfig };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { content: "", config: {} };
    throw error;
  }
}

export function createClaudeIntegrationService(store: MemoryStore) {
  const getClaudeIntegration = async () => {
    const content = await readClaudeAgents();
    const start = content.indexOf(claudeGuidanceStart);
    const end = content.indexOf(claudeGuidanceEnd, start + claudeGuidanceStart.length);
    const installed = start >= 0 && end >= 0;
    const managed = installed ? content.slice(start, end + claudeGuidanceEnd.length) : "";
    return { path: claudeAgentsPath, status: installed ? managed === claudeGuidance ? "configured" : "update_available" : "not_configured" };
  };

  const installClaudeIntegration = async () => {
    const content = await readClaudeAgents();
    const preserved = removeManagedClaudeGuidance(content);
    await mkdir(dirname(claudeAgentsPath), { recursive: true });
    await writeFile(claudeAgentsPath, `${preserved ? `${preserved}\n\n` : ""}${claudeGuidance}\n`, "utf8");
    return getClaudeIntegration();
  };

  const getClaudeMcpIntegration = async (expectedEndpoint: string) => {
    const { content, config } = await readClaudeConfig();
    const server = config.mcpServers?.["memory-one"];
    const endpoint = server?.url ?? null;
    const authorization = server?.headers?.Authorization ?? server?.headers?.authorization;
    const key = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
    const keyRecord = key ? store.verifyMcpKey(key) : null;
    const authRequired = store.getMcpConfig().use_bearer_key;
    const configured = endpoint === expectedEndpoint && (authRequired ? Boolean(keyRecord) : !authorization);
    return {
      path: claudeMcpConfigPath,
      detected: Boolean(content),
      endpoint,
      auth_required: authRequired,
      configured_key_id: keyRecord?.id ?? null,
      status: configured ? "configured" : server ? "update_available" : "not_configured",
    };
  };

  const installClaudeMcpIntegration = async (endpoint: string, keyId?: string) => {
    const authRequired = store.getMcpConfig().use_bearer_key;
    const key = authRequired && keyId ? store.getMcpKey(keyId) : null;
    if (authRequired && (!key?.secret || key.revoked_at)) throw new Error("mcp_key_not_found");
    const { config } = await readClaudeConfig();
    config.mcpServers = {
      ...(config.mcpServers ?? {}),
      "memory-one": {
        type: "http",
        url: endpoint,
        ...(authRequired ? { headers: { Authorization: `Bearer ${key!.secret}` } } : {}),
      },
    };
    await mkdir(dirname(claudeMcpConfigPath), { recursive: true });
    await writeFile(claudeMcpConfigPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
    return getClaudeMcpIntegration(endpoint);
  };

  return { getClaudeIntegration, installClaudeIntegration, getClaudeMcpIntegration, installClaudeMcpIntegration };
}

export type ClaudeIntegrationService = ReturnType<typeof createClaudeIntegrationService>;
