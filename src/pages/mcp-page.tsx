import { useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  Check,
  Copy,
  FileCog,
  KeyRound,
  LoaderCircle,
  Pencil,
  Server,
  X,
} from "lucide-react";
import { ui } from "../lib/copy.js";
import { formatDate } from "../lib/format.js";
import type {
  ClaudeIntegration,
  ClaudeMcpIntegration,
  CodexIntegration,
  CodexMcpIntegration,
  Language,
  McpKey,
  McpToolStats,
} from "../types.js";
import { Stat } from "../components/stat.js";

const mcpTools = [
  [
    "memory_store",
    "Store durable memory with optional scope.",
    "保存一条持久记忆，可选 scope 分类。",
  ],
  [
    "memory-search",
    "Search memories with SQLite FTS5 and an optional scope filter.",
    "使用 SQLite FTS5 按需搜索记忆，可按 scope 筛选。",
  ],
  [
    "memory-get-context",
    "Retrieve persistent context at the start of a new task.",
    "在新任务开始时读取固定上下文。",
  ],
  ["memory_get", "Get one memory by ID.", "按 ID 获取单条记忆。"],
  [
    "memory_list",
    "List memories with an optional scope filter.",
    "列出记忆，可按 scope 筛选。",
  ],
  [
    "memory_update",
    "Update a memory or its metadata.",
  ],
] as const;

const mcpCopy = {
  zh: {
    copied: "已复制到剪贴板",
    copyFailed: "复制失败，请手动复制",
    codexWritten: "Codex MCP 配置已写入。重新启动 Codex 或开启新会话后生效。",
    claudeWritten: "Claude MCP 配置已写入。重新启动 Claude Code 或开启新会话后生效。",
    codexWriteFailed: "配置失败，请检查 Codex 配置目录。",
    claudeWriteFailed: "配置失败，请检查 Claude Code 配置目录。",
    codexGuidanceWritten: "全局指令已写入。重新启动 Codex 或开启新会话后生效。",
    claudeGuidanceWritten: "Claude Code 全局增强已写入。重新启动 Claude Code 或开启新会话后生效。",
    claudeGuidanceWriteFailed: "写入失败，请检查 Claude Code 配置目录的访问权限。",
    writeFailed: "写入失败，请检查 Codex 配置目录的访问权限。",
    keyCreateFailed: "Key 创建失败，请稍后重试。",
    keyDeleteConfirm: (name: string) => `确定删除 Key“${name}”吗？删除后将立即失效，且无法恢复。`,
    keyDelete: "删除",
    keyCreated: "Key 已创建，可随时在下方再次复制",
    copyConfig: "复制配置",
    copiedConfig: "配置已复制",
    copyAuthConfig: "复制带 Authorization Header 的配置",
    keyName: "Key 名称",
    unnamedKey: "未命名 Key",
    access: "访问控制",
    keyManage: "MCP Key 管理",
    keyNote: "为每个客户端创建独立 Key，并按最小权限限制可调用的工具。",
    createKey: "创建 Key",
    keyEmpty: "暂无 Key",
    allowTools: "允许调用的工具",
    keyPlaceholder: "例如：平台 Agent",
    allTools: "可调用全部工具",
    toolCount: (n: number, total: number) => `可用工具 ${n}/${total}`,
    recent: (value: string) => `最近使用 ${value}`,
    never: "尚未使用",
    rename: "修改名称",
    connectionTab: "连接配置",
    usageTab: "调用统计",
    mcpPage: "MCP 页面",
    streamable: "Streamable HTTP",
    bearer: "Bearer Key",
    codexConnection: "MCP 连接",
    chooseKey: "选择用于连接的 Key。",
    autoConnection: "将自动保存连接配置。",
    readingAuth: "正在读取认证状态。",
    createFirst: "请先创建 MCP Key",
    configured: "已配置",
    configure: "配置",
    update: "更新",
    taskMemory: "任务前置记忆",
    taskMemoryDesc: "每项任务开始前读取一次；同一任务已有结果时用 memory-search 查询。",
    enabled: "已启用",
    needUpdate: "需要更新",
    notConfigured: "未配置",
    detecting: "检查中",
    reading: "读取中",
    usage: "调用统计",
    usageTitle: "工具使用情况",
    total: "累计调用",
    failed: (n: number) => `${n} 次失败`,
    latency: "平均处理耗时",
    lastCall: "最近一次调用",
    none: "暂无",
    delete: "删除",
    callCount: "次",
    accessEyebrow: "访问控制",
    createMcpKey: "创建 MCP Key",
    close: "关闭",
  },
  en: {
    copied: "Copied",
    copyFailed: "Copy failed. Copy it manually.",
    codexWritten: "Codex MCP configuration saved. Restart Codex or start a new session to apply it.",
    codexWriteFailed: "Could not save the configuration. Check the Codex configuration directory.",
    claudeWritten: "Claude MCP configuration saved. Restart Claude Code or start a new session to apply it.",
    claudeWriteFailed: "Could not save the configuration. Check the Claude Code configuration directory.",
    codexGuidanceWritten: "Global guidance saved. Restart Codex or start a new session to apply it.",
    claudeGuidanceWritten: "Claude Code global enhancement saved. Restart Claude Code or start a new session to apply it.",
    claudeGuidanceWriteFailed: "Could not save global guidance. Check the Claude Code configuration directory.",
    writeFailed: "Could not save global guidance. Check the Codex configuration directory.",
    keyCreateFailed: "Could not create the key. Try again.",
    keyDeleteConfirm: (name: string) => `Delete key “${name}”? It will stop working immediately.`,
    keyDelete: "Delete",
    keyCreated: "Key created. You can copy it below.",
    copyConfig: "Copy configuration",
    copiedConfig: "Configuration copied",
    copyAuthConfig: "Copy configuration with Authorization Header",
    keyName: "Key name",
    unnamedKey: "Unnamed key",
    access: "Access",
    keyManage: "MCP keys",
    keyNote: "Create one key per client and limit the tools it can call.",
    createKey: "Create key",
    keyEmpty: "No keys yet.",
    allowTools: "Allowed tools",
    keyPlaceholder: "For example: Workspace agent",
    allTools: "All tools",
    toolCount: (n: number, total: number) => `${n}/${total} tools`,
    recent: (value: string) => `Last used ${value}`,
    never: "Not used",
    rename: "Rename",
    connectionTab: "Connection",
    usageTab: "Usage",
    mcpPage: "MCP page",
    streamable: "Streamable HTTP",
    bearer: "Bearer Key",
    codexConnection: "MCP connection",
    chooseKey: "Choose a key for the connection.",
    autoConnection: "The connection will be saved automatically.",
    readingAuth: "Checking authentication status.",
    createFirst: "Create an MCP key first",
    configured: "Configured",
    configure: "Configure",
    update: "Update",
    taskMemory: "Task memory",
    taskMemoryDesc: "Read once before each task; use memory-search for follow-ups instead of calling again.",
    enabled: "Enabled",
    needUpdate: "Needs update",
    notConfigured: "Not configured",
    detecting: "Checking",
    reading: "Loading",
    usage: "Usage",
    usageTitle: "Tool usage",
    total: "Total calls",
    failed: (n: number) => `${n} failed`,
    latency: "Average latency",
    lastCall: "Last call",
    none: "None",
    delete: "Delete",
    callCount: "calls",
    accessEyebrow: "Access",
    createMcpKey: "Create MCP key",
    close: "Close",
  },
} as const;

export default function McpPage({ language }: { language: Language }) {
  const copy = ui[language];
  const m = mcpCopy[language];
  const [copied, setCopied] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [stats, setStats] = useState<McpToolStats | null>(null);
  const [codexIntegration, setCodexIntegration] =
    useState<CodexIntegration | null>(null);
  const [codexInstalling, setCodexInstalling] = useState(false);
  const [codexMessage, setCodexMessage] = useState("");
  const [codexMcpIntegration, setCodexMcpIntegration] = useState<CodexMcpIntegration | null>(null);
  const [codexMcpKeyId, setCodexMcpKeyId] = useState("");
  const [codexMcpInstalling, setCodexMcpInstalling] = useState(false);
  const [codexMcpMessage, setCodexMcpMessage] = useState("");
  const [claudeIntegration, setClaudeIntegration] = useState<ClaudeIntegration | null>(null);
  const [claudeInstalling, setClaudeInstalling] = useState(false);
  const [claudeMessage, setClaudeMessage] = useState("");
  const [claudeMcpIntegration, setClaudeMcpIntegration] = useState<ClaudeMcpIntegration | null>(null);
  const [claudeMcpKeyId, setClaudeMcpKeyId] = useState("");
  const [claudeMcpInstalling, setClaudeMcpInstalling] = useState(false);
  const [claudeMcpMessage, setClaudeMcpMessage] = useState("");
  const [mcpKeys, setMcpKeys] = useState<McpKey[]>([]);
  const [keyName, setKeyName] = useState("");
  const [keyTools, setKeyTools] = useState<string[]>(mcpTools.map(([name]) => name));
  const [newKeySecret, setNewKeySecret] = useState<string | null>(null);
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyMessage, setKeyMessage] = useState("");
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [useBearerKey, setUseBearerKey] = useState<boolean | null>(null);
  const [editingKeyId, setEditingKeyId] = useState<string | null>(null);
  const [editingKeyName, setEditingKeyName] = useState("");
  const [activeTab, setActiveTab] = useState<"connection" | "usage">("connection");
  const host =
    typeof window !== "undefined" && window.location.hostname
      ? window.location.hostname
      : "127.0.0.1";
  const pagePort = typeof window !== "undefined" ? window.location.port : "";
  const serverPort = pagePort === "5173" || !pagePort ? "8765" : pagePort;
  const endpoint = `http://${host}:${serverPort}/mcp/`;
  const callsByTool = new Map(
    stats?.tools.map((tool) => [tool.tool_name, tool.calls]) ?? [],
  );
  const successRate = stats?.total_calls
    ? Math.round((stats.successful_calls / stats.total_calls) * 100)
    : 0;
  useEffect(() => {
    fetch("/api/mcp/config").then((response) => response.json()).then((value: { use_bearer_key?: boolean }) => setUseBearerKey(value.use_bearer_key !== false));
    fetch("/api/mcp/stats")
      .then((response) => response.json())
      .then(setStats);
    fetch("/api/integrations/codex")
      .then((response) => response.json())
      .then(setCodexIntegration);
    fetch(`/api/integrations/codex/mcp?endpoint=${encodeURIComponent(endpoint)}`)
      .then((response) => response.json())
      .then(setCodexMcpIntegration);
    fetch("/api/integrations/claude")
      .then((response) => response.json())
      .then(setClaudeIntegration);
    fetch(`/api/integrations/claude/mcp?endpoint=${encodeURIComponent(endpoint)}`)
      .then((response) => response.json())
      .then(setClaudeMcpIntegration);
    fetch("/api/mcp/keys")
      .then((response) => response.json())
      .then(setMcpKeys);
  }, []);
  useEffect(() => {
    const availableKeys = mcpKeys.filter((key) => key.secret);
    if (codexMcpIntegration?.configured_key_id) setCodexMcpKeyId(codexMcpIntegration.configured_key_id);
    else if (!availableKeys.some((key) => key.id === codexMcpKeyId)) setCodexMcpKeyId(availableKeys[0]?.id ?? "");
  }, [codexMcpIntegration, codexMcpKeyId, mcpKeys]);
  useEffect(() => {
    const availableKeys = mcpKeys.filter((key) => key.secret);
    if (claudeMcpIntegration?.configured_key_id) setClaudeMcpKeyId(claudeMcpIntegration.configured_key_id);
    else if (!availableKeys.some((key) => key.id === claudeMcpKeyId)) setClaudeMcpKeyId(availableKeys[0]?.id ?? "");
  }, [claudeMcpIntegration, claudeMcpKeyId, mcpKeys]);
  const updateBearerKey = async (enabled: boolean) => {
    setUseBearerKey(enabled);
    await fetch("/api/mcp/config", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ use_bearer_key: enabled }) });
    const [codexResponse, claudeResponse] = await Promise.all([
      fetch(`/api/integrations/codex/mcp?endpoint=${encodeURIComponent(endpoint)}`),
      fetch(`/api/integrations/claude/mcp?endpoint=${encodeURIComponent(endpoint)}`),
    ]);
    setCodexMcpIntegration(await codexResponse.json());
    setClaudeMcpIntegration(await claudeResponse.json());
  };
  const copyText = async (value: string, key: string) => {
    try {
      if (!navigator.clipboard) throw new Error("clipboard_unavailable");
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setCopyMessage(m.copied);
      window.setTimeout(() => setCopied(null), 1500);
      window.setTimeout(() => setCopyMessage(null), 2200);
    } catch {
      setCopyMessage(m.copyFailed);
      window.setTimeout(() => setCopyMessage(null), 2600);
    }
  };
  const installCodex = async () => {
    setCodexInstalling(true);
    setCodexMessage("");
    try {
      const response = await fetch("/api/integrations/codex/install", {
        method: "POST",
      });
      if (!response.ok) throw new Error("install_failed");
      setCodexIntegration(await response.json());
      setCodexMessage(m.codexGuidanceWritten);
    } catch {
      setCodexMessage(m.writeFailed);
    } finally {
      setCodexInstalling(false);
    }
  };
  const installCodexMcp = async () => {
    setCodexMcpInstalling(true);
    setCodexMcpMessage("");
    try {
      const response = await fetch("/api/integrations/codex/mcp/install", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint, ...(useBearerKey === true ? { key_id: codexMcpKeyId } : {}) }),
      });
      if (!response.ok) throw new Error("install_failed");
      setCodexMcpIntegration(await response.json());
      setCodexMcpMessage(m.codexWritten);
    } catch {
      setCodexMcpMessage(m.codexWriteFailed);
    } finally {
      setCodexMcpInstalling(false);
    }
  };
  const installClaude = async () => {
    setClaudeInstalling(true);
    setClaudeMessage("");
    try {
      const response = await fetch("/api/integrations/claude/install", { method: "POST" });
      if (!response.ok) throw new Error("install_failed");
      setClaudeIntegration(await response.json());
      setClaudeMessage(m.claudeGuidanceWritten);
    } catch {
      setClaudeMessage(m.claudeGuidanceWriteFailed);
    } finally {
      setClaudeInstalling(false);
    }
  };
  const installClaudeMcp = async () => {
    setClaudeMcpInstalling(true);
    setClaudeMcpMessage("");
    try {
      const response = await fetch("/api/integrations/claude/mcp/install", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint, ...(useBearerKey === true ? { key_id: claudeMcpKeyId } : {}) }),
      });
      if (!response.ok) throw new Error("install_failed");
      setClaudeMcpIntegration(await response.json());
      setClaudeMcpMessage(m.claudeWritten);
    } catch {
      setClaudeMcpMessage(m.claudeWriteFailed);
    } finally {
      setClaudeMcpInstalling(false);
    }
  };
  const createMcpKey = async () => {
    setKeyBusy(true);
    setKeyMessage("");
    try {
      const response = await fetch("/api/mcp/keys", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: keyName.trim() || m.unnamedKey, allowed_tools: keyTools }) });
      if (!response.ok) throw new Error("create_key_failed");
      const result = (await response.json()) as { key: string; key_record: McpKey };
      setMcpKeys((current) => [result.key_record, ...current]);
      setNewKeySecret(result.key);
      setKeyName("");
    } catch {
      setKeyMessage(m.keyCreateFailed);
    } finally {
      setKeyBusy(false);
    }
  };
  const revokeMcpKey = async (id: string) => {
    const key = mcpKeys.find((item) => item.id === id);
    if (!key || !window.confirm(m.keyDeleteConfirm(key.name))) return;
    const response = await fetch(`/api/mcp/keys/${id}`, { method: "DELETE" });
    if (!response.ok) return;
    setMcpKeys((current) => current.filter((item) => item.id !== id));
  };
  const renameMcpKey = async (id: string) => {
    const response = await fetch(`/api/mcp/keys/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: editingKeyName }) });
    if (!response.ok) return;
    const updated = await response.json() as McpKey;
    setMcpKeys((current) => current.map((key) => key.id === id ? updated : key));
    setEditingKeyId(null);
  };
  const keyConfig = newKeySecret ? JSON.stringify({ mcpServers: { "memory-one": { type: "http", url: endpoint, ...(useBearerKey === true ? { headers: { Authorization: `Bearer ${newKeySecret}` } } : {}) } } }, null, 2) : "";
  const codexStatus =
    codexIntegration?.status === "configured"
      ? m.configured
      : codexIntegration?.status === "update_available"
        ? m.needUpdate
        : m.notConfigured;
  const codexButton =
    codexIntegration?.status === "update_available"
      ? m.update
      : m.enabled;
  const codexMcpConfigured = codexMcpIntegration?.status === "configured" && (useBearerKey !== true || codexMcpIntegration.configured_key_id === codexMcpKeyId);
  const codexMcpStatus =
    codexMcpIntegration?.status === "configured"
      ? m.configured
      : codexMcpIntegration?.status === "update_available"
        ? m.needUpdate
        : m.notConfigured;
  const claudeStatus =
    claudeIntegration?.status === "configured"
      ? m.configured
      : claudeIntegration?.status === "update_available"
        ? m.needUpdate
        : m.notConfigured;
  const claudeButton =
    claudeIntegration?.status === "update_available"
      ? m.update
      : m.enabled;
  const claudeMcpConfigured = claudeMcpIntegration?.status === "configured" && (useBearerKey !== true || claudeMcpIntegration.configured_key_id === claudeMcpKeyId);
  const claudeMcpStatus =
    claudeMcpIntegration?.status === "configured"
      ? m.configured
      : claudeMcpIntegration?.status === "update_available"
        ? m.needUpdate
        : m.notConfigured;
  return (
    <div className={`mcp-page ${useBearerKey === null ? "mcp-loading" : ""}`}>
      {copyMessage ? <div className={`copy-feedback ${copyMessage === m.copyFailed ? "error" : ""}`} role="status">{copyMessage === m.copyFailed ? <AlertCircle size={14} /> : <Check size={14} />}{copyMessage}</div> : null}
      <div className="mcp-navigation">
      <nav className="mcp-tabs" role="tablist" aria-label={m.mcpPage}>
        <button className={activeTab === "connection" ? "active" : ""} role="tab" aria-selected={activeTab === "connection"} onClick={() => setActiveTab("connection")}><Server size={15} />{m.connectionTab}</button>
        <button className={activeTab === "usage" ? "active" : ""} role="tab" aria-selected={activeTab === "usage"} onClick={() => setActiveTab("usage")}><Activity size={15} />{m.usageTab}</button>
      </nav>
      </div>
      {activeTab === "connection" && <div className="mcp-grid" role="tabpanel">
        <section className="mcp-panel mcp-endpoint">
          <div className="mcp-panel-header">
            <div>
              <span className="eyebrow">{copy.serverEndpoint}</span>
              <h2>{copy.mcpEndpoint}</h2>
            </div>
            <button
              className="icon-button"
              onClick={() => copyText(endpoint, "endpoint")}
              title={copy.mcpCopyEndpoint}
            >
              {copied === "endpoint" ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
          <div className="endpoint-value">{endpoint}</div>
          <div className="endpoint-compact-meta">
            <span><i className="status-dot" />{m.streamable}</span>
            <label className="switch-label"><span>{m.bearer}</span><input type="checkbox" checked={useBearerKey === true} disabled={useBearerKey === null} onChange={(event) => updateBearerKey(event.target.checked)} /><i /></label>
          </div>
        </section>
        <section className="mcp-panel codex-mcp-panel">
          <span className="eyebrow codex-compact-heading">Codex</span>
          <div className="codex-compact-list">
            <section className="codex-compact-row">
              <div className="codex-compact-copy">
                <div className="codex-compact-title"><strong>{m.codexConnection}</strong><span className={`integration-status status-${codexMcpIntegration?.status ?? "loading"}`}>{codexMcpIntegration ? codexMcpStatus : m.detecting}</span></div>
                <p>{useBearerKey === true ? m.chooseKey : useBearerKey === false ? m.autoConnection : m.readingAuth}</p>
                {codexMcpMessage ? <div className="integration-message" role="status">{codexMcpMessage}</div> : null}
              </div>
              <div className="codex-compact-actions">
                {useBearerKey === true ? <select aria-label={m.bearer} value={codexMcpKeyId} onChange={(event) => setCodexMcpKeyId(event.target.value)} disabled={!mcpKeys.some((key) => key.secret)}>
                {mcpKeys.filter((key) => key.secret).map((key) => <option key={key.id} value={key.id}>{key.name} · {key.prefix}••••</option>)}
                {!mcpKeys.some((key) => key.secret) ? <option value="">{m.createFirst}</option> : null}
                </select> : null}
                <button className="primary-button" disabled={useBearerKey === null || !codexMcpIntegration || (useBearerKey === true && !codexMcpKeyId) || codexMcpInstalling || codexMcpConfigured} onClick={() => void installCodexMcp()}>{codexMcpInstalling ? <LoaderCircle className="spin" size={16} /> : <Server size={16} />}{codexMcpConfigured ? m.configured : codexMcpIntegration?.status === "not_configured" ? m.configure : m.update}</button>
              </div>
            </section>
            <section className="codex-compact-row">
              <div className="codex-compact-copy">
                <div className="codex-compact-title"><strong>{m.taskMemory}</strong><span className={`integration-status status-${codexIntegration?.status ?? "loading"}`}>{codexIntegration ? codexStatus : m.reading}</span></div>
                <p>{m.taskMemoryDesc}</p>
                {codexMessage ? <div className="integration-message" role="status">{codexMessage}</div> : null}
              </div>
              <button className="primary-button" disabled={!codexIntegration || codexInstalling || codexIntegration.status === "configured"} onClick={installCodex}>{codexInstalling ? <LoaderCircle className="spin" size={16} /> : <FileCog size={16} />}{codexIntegration?.status === "configured" ? m.enabled : codexButton}</button>
            </section>
          </div>
        </section>
        <section className="mcp-panel codex-mcp-panel client-mcp-panel">
          <span className="eyebrow codex-compact-heading">Claude Code</span>
          <div className="codex-compact-list">
            <section className="codex-compact-row">
              <div className="codex-compact-copy">
                <div className="codex-compact-title"><strong>{m.codexConnection}</strong><span className={`integration-status status-${claudeMcpIntegration?.status ?? "loading"}`}>{claudeMcpIntegration ? claudeMcpStatus : m.detecting}</span></div>
                <p>{useBearerKey === true ? m.chooseKey : useBearerKey === false ? m.autoConnection : m.readingAuth}</p>
                {claudeMcpMessage ? <div className="integration-message" role="status">{claudeMcpMessage}</div> : null}
              </div>
              <div className="codex-compact-actions">
                {useBearerKey === true ? <select aria-label={m.bearer} value={claudeMcpKeyId} onChange={(event) => setClaudeMcpKeyId(event.target.value)} disabled={!mcpKeys.some((key) => key.secret)}>
                {mcpKeys.filter((key) => key.secret).map((key) => <option key={key.id} value={key.id}>{key.name} · {key.prefix}••••</option>)}
                {!mcpKeys.some((key) => key.secret) ? <option value="">{m.createFirst}</option> : null}
                </select> : null}
                <button className="primary-button" disabled={useBearerKey === null || !claudeMcpIntegration || (useBearerKey === true && !claudeMcpKeyId) || claudeMcpInstalling || claudeMcpConfigured} onClick={() => void installClaudeMcp()}>{claudeMcpInstalling ? <LoaderCircle className="spin" size={16} /> : <Server size={16} />}{claudeMcpConfigured ? m.configured : claudeMcpIntegration?.status === "not_configured" ? m.configure : m.update}</button>
              </div>
            </section>
            <section className="codex-compact-row">
              <div className="codex-compact-copy">
                <div className="codex-compact-title"><strong>{m.taskMemory}</strong><span className={`integration-status status-${claudeIntegration?.status ?? "loading"}`}>{claudeIntegration ? claudeStatus : m.reading}</span></div>
                <p>{m.taskMemoryDesc}</p>
                {claudeMessage ? <div className="integration-message" role="status">{claudeMessage}</div> : null}
              </div>
              <button className="primary-button" disabled={!claudeIntegration || claudeInstalling || claudeIntegration.status === "configured"} onClick={installClaude}>{claudeInstalling ? <LoaderCircle className="spin" size={16} /> : <FileCog size={16} />}{claudeIntegration?.status === "configured" ? m.enabled : claudeButton}</button>
            </section>
          </div>
        </section>
        {useBearerKey === true && <section className="mcp-keys" role="region" aria-label={m.keyManage}>
          <div className="mcp-tools-heading"><div><span className="eyebrow">{m.access}</span><h2>{m.keyManage}</h2></div><KeyRound size={18} /></div>
          <p className="mcp-key-note">{m.keyNote}</p>
          <div className="mcp-key-create"><button className="primary-button" onClick={() => setShowKeyForm(true)}><KeyRound size={15} />{m.createKey}</button></div>
          {newKeySecret ? <div className="mcp-key-secret"><strong>{m.keyCreated}</strong><code>{newKeySecret}</code><div><button className="icon-button" onClick={() => copyText(keyConfig, "key-config")} title={m.copyConfig}>{copied === "key-config" ? <Check size={16} /> : <Copy size={16} />}</button><span>{copied === "key-config" ? m.copiedConfig : m.copyAuthConfig}</span></div></div> : null}
          <div className="mcp-key-list">{mcpKeys.length ? mcpKeys.map((key) => <div className="mcp-key-row" key={key.id}><KeyRound size={15} /><div>{editingKeyId === key.id ? <input className="mcp-key-name-input" autoFocus value={editingKeyName} onChange={(event) => setEditingKeyName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void renameMcpKey(key.id); if (event.key === "Escape") setEditingKeyId(null); }} onBlur={() => void renameMcpKey(key.id)} /> : <strong>{key.name}</strong>}<code>{key.prefix}••••••••</code><span>{key.allowed_tools.length ? m.toolCount(key.allowed_tools.length, mcpTools.length) : m.allTools}{key.last_used_at ? ` · ${m.recent(formatDate(key.last_used_at, language))}` : ` · ${m.never}`}</span><div className="tool-chip-list key-tool-list">{(key.allowed_tools.length ? key.allowed_tools : mcpTools.map(([name]) => name)).map((name) => <span className="tool-chip" key={name}>{name}</span>)}</div></div><div className="mcp-key-actions">{key.secret ? <button className="icon-button" onClick={() => copyText(key.secret!, `key-${key.id}`)} title={m.copyConfig}>{copied === `key-${key.id}` ? <Check size={14} /> : <Copy size={14} />}</button> : null}<button className="icon-button" onClick={() => { setEditingKeyId(key.id); setEditingKeyName(key.name); }} title={m.rename}><Pencil size={14} /></button><button className="ghost-button" onClick={() => void revokeMcpKey(key.id)}>{m.delete}</button></div></div>) : <p className="mcp-key-empty">{m.keyEmpty}</p>}</div>
        </section>}
      </div>}
      {showKeyForm && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowKeyForm(false); }}><section className="key-create-modal" role="dialog" aria-modal="true" aria-label={m.createKey}>
        <div className="composer-header"><div><span className="eyebrow">{m.accessEyebrow}</span><h2>{m.createMcpKey}</h2></div><button className="icon-button" onClick={() => setShowKeyForm(false)} title={m.close} aria-label={m.close}><X size={18} /></button></div>
        <label className="config-field"><span>{m.keyName}</span><input autoFocus value={keyName} onChange={(event) => setKeyName(event.target.value)} placeholder={m.keyPlaceholder} /></label>
        <div className="mcp-key-tools"><span className="key-tools-label">{m.allowTools}</span><div className="key-tools-grid">{mcpTools.map(([name]) => <label key={name}><input type="checkbox" checked={keyTools.includes(name)} onChange={(event) => setKeyTools((current) => event.target.checked ? [...current, name] : current.filter((item) => item !== name))} />{name}</label>)}</div></div>
        <div className="modal-actions"><button className="ghost-button" onClick={() => setShowKeyForm(false)}>{copy.cancel}</button><button className="primary-button" onClick={() => { void createMcpKey(); setShowKeyForm(false); }} disabled={keyBusy || keyTools.length === 0}>{keyBusy ? <LoaderCircle className="spin" size={15} /> : <KeyRound size={15} />}{m.createKey}</button></div>
        {keyMessage ? <p className="integration-message" role="alert">{keyMessage}</p> : null}
      </section></div>}
      {activeTab === "usage" && <>
      <section className="mcp-usage" role="tabpanel">
        <div className="mcp-tools-heading">
          <div>
            <span className="eyebrow">{m.usage}</span>
            <h2>{m.usageTitle}</h2>
          </div>
          <Activity size={18} />
        </div>
        <div className="mcp-metrics">
          <Stat
            label="TOTAL CALLS"
            value={stats ? String(stats.total_calls) : "--"}
            note={m.total}
          />
          <Stat
            label="SUCCESS RATE"
            value={stats?.total_calls ? `${successRate}%` : "--"}
            note={stats ? m.failed(stats.failed_calls) : m.reading}
          />
          <Stat
            label="AVG LATENCY"
            value={
              stats?.total_calls ? `${stats.average_duration_ms} ms` : "--"
            }
            note={m.latency}
          />
          <Stat
            label="LAST CALL"
            value={
              stats?.last_called_at
                ? formatDate(stats.last_called_at, language)
                : m.none
            }
            note={m.lastCall}
            date
          />
        </div>
      </section>
      <section className="mcp-tools">
        <div className="mcp-tools-heading">
          <div>
            <span className="eyebrow">{copy.toolsLabel}</span>
            <h2>{copy.toolsTitle}</h2>
          </div>
          <span className="tool-count">
            {mcpTools.length} {copy.toolsCount}
          </span>
        </div>
        <div className="tool-list">
          {mcpTools.map(([name, enDescription, zhDescription]) => (
            <article className="tool-row" key={name}>
              <div className="tool-icon">
                <Server size={15} />
              </div>
              <div>
                <strong>{name}</strong>
                <span>{language === "zh" ? zhDescription : enDescription}</span>
              </div>
              <div className="tool-meta">
                <code>{callsByTool.get(name) ?? 0} {m.callCount}</code>
                <code>{copy.http}</code>
              </div>
            </article>
          ))}
        </div>
      </section>
      </>}
    </div>
  );
}
