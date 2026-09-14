import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { MemoryStore } from "../storage.js";

const codexAgentsPath = join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "AGENTS.md");
const codexConfigPath = join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "config.toml");
const codexGuidanceStart = "<!-- memory-one:codex:start -->";
const codexGuidanceEnd = "<!-- memory-one:codex:end -->";
const codexGuidance = `${codexGuidanceStart}
## Memory One

Before starting any new user task, call the Memory One MCP tool \`memory-get-context\` once to retrieve persistent context.

- When working in a project, resolve the Git repository root and pass its absolute directory path as \`scope\`. Use the same scope when storing project-specific memory; omit \`scope\` for general preferences and knowledge.
- Apply the returned persistent preferences and project conventions before planning, answering, editing files, or calling task-specific tools.
- If a \`memory-get-context\` result already exists in the current task conversation, do not call it again; use \`memory-search\` when a specific historical preference, decision, fact, or project convention is needed.
- Only save a memory when the user explicitly asks to remember or save it; if a durable preference, decision, project convention, personal fact, or correction seems worth keeping but the user did not ask, ask for confirmation instead. Use \`memory_update\` only after the user explicitly asks to change an existing memory. Do not save clearly transient, one-off details.
- Before storing, prefer updating or superseding a similar memory instead of creating a near-duplicate.
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

async function readCodexConfig() {
  try {
    return await readFile(codexConfigPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw error;
  }
}

function isMemoryOneCodexSection(name: string) {
  const normalized = name.replace(/"memory-one"/g, "memory-one");
  return normalized === "mcp_servers.memory-one" || normalized.startsWith("mcp_servers.memory-one.");
}

function getMemoryOneCodexSections(content: string) {
  const sections: string[] = [];
  let current: string[] | null = null;
  for (const line of content.split("\n")) {
    const section = line.match(/^\s*\[([^\]]+)]\s*(?:#.*)?$/);
    if (section) {
      if (current) sections.push(current.join("\n"));
      current = isMemoryOneCodexSection(section[1].trim()) ? [line] : null;
    } else if (current) current.push(line);
  }
  if (current) sections.push(current.join("\n"));
  return sections.join("\n");
}

function removeMemoryOneCodexSections(content: string) {
  const lines: string[] = [];
  let removing = false;
  for (const line of content.split("\n")) {
    const section = line.match(/^\s*\[([^\]]+)]\s*(?:#.*)?$/);
    if (section) removing = isMemoryOneCodexSection(section[1].trim());
    if (!removing) lines.push(line);
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();
}

function readTomlString(source: string, key: string) {
  const match = source.match(new RegExp(`(?:^|[,{]\\s*)${key}\\s*=\\s*("(?:[^"\\\\]|\\\\.)*"|'[^']*')`, "im"));
  if (!match) return null;
  if (match[1].startsWith("'")) return match[1].slice(1, -1);
  try { return JSON.parse(match[1]) as string; } catch { return null; }
}

export function createCodexIntegrationService(store: MemoryStore) {
  const getCodexIntegration = async () => {
    const content = await readCodexAgents();
    const start = content.indexOf(codexGuidanceStart);
    const end = content.indexOf(codexGuidanceEnd, start + codexGuidanceStart.length);
    const installed = start >= 0 && end >= 0;
    const managed = installed ? content.slice(start, end + codexGuidanceEnd.length) : "";
    return { path: codexAgentsPath, status: installed ? managed === codexGuidance ? "configured" : "update_available" : "not_configured" };
  };

  const installCodexIntegration = async () => {
    const content = await readCodexAgents();
    const preserved = removeManagedCodexGuidance(content);
    await mkdir(dirname(codexAgentsPath), { recursive: true });
    await writeFile(codexAgentsPath, `${preserved ? `${preserved}\n\n` : ""}${codexGuidance}\n`, "utf8");
    return getCodexIntegration();
  };

  const getCodexMcpIntegration = async (expectedEndpoint: string) => {
    const content = await readCodexConfig();
    const sections = getMemoryOneCodexSections(content);
    const endpoint = readTomlString(sections, "url");
    const authorization = readTomlString(sections, "Authorization");
    const key = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
    const keyRecord = key ? store.verifyMcpKey(key) : null;
    const authRequired = store.getMcpConfig().use_bearer_key;
    const configured = endpoint === expectedEndpoint && (authRequired ? Boolean(keyRecord) : !authorization);
    return {
      path: codexConfigPath,
      detected: Boolean(content),
      endpoint,
      auth_required: authRequired,
      configured_key_id: keyRecord?.id ?? null,
      status: configured ? "configured" : sections ? "update_available" : "not_configured",
    };
  };

  const installCodexMcpIntegration = async (endpoint: string, keyId?: string) => {
    const authRequired = store.getMcpConfig().use_bearer_key;
    const key = authRequired && keyId ? store.getMcpKey(keyId) : null;
    if (authRequired && (!key?.secret || key.revoked_at)) throw new Error("mcp_key_not_found");
    const content = await readCodexConfig();
    const preserved = removeMemoryOneCodexSections(content);
    const section = `[mcp_servers.memory-one]\nurl = ${JSON.stringify(endpoint)}${authRequired ? `\nhttp_headers = { Authorization = ${JSON.stringify(`Bearer ${key!.secret}`)} }` : ""}`;
    await mkdir(dirname(codexConfigPath), { recursive: true });
    await writeFile(codexConfigPath, `${preserved ? `${preserved}\n\n` : ""}${section}\n`, "utf8");
    return getCodexMcpIntegration(endpoint);
  };

  return { getCodexIntegration, installCodexIntegration, getCodexMcpIntegration, installCodexMcpIntegration };
}

export type CodexIntegrationService = ReturnType<typeof createCodexIntegrationService>;
