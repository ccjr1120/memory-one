import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import {
  AlertCircle,
  Activity,
  Archive,
  ArrowUpRight,
  BookOpen,
  Bot,
  Brain,
  Check,
  ChevronDown,
  Clock3,
  Command,
  Copy,
  Database,
  FileCog,
  FileText,
  Filter,
  Layers3,
  KeyRound,
  LoaderCircle,
  Menu,
  MessageCircle,
  Moon,
  Pencil,
  Plus,
  Search,
  Send,
  Server,
  Settings2,
  Sparkles,
  Sun,
  Tag,
  X,
} from "lucide-react";
import { Select } from "./components/ui/select";
import "./styles.css";
import { Streamdown } from "streamdown";
import "streamdown/styles.css";

type Memory = {
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
  metadata: Record<string, unknown>;
};
type McpToolStats = {
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
type McpKey = {
  id: string;
  name: string;
  prefix: string;
  secret: string | null;
  allowed_tools: string[];
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};
type CodexIntegration = {
  path: string;
  status: "not_configured" | "configured" | "update_available";
};
type CodexMcpIntegration = {
  path: string;
  detected: boolean;
  endpoint: string | null;
  auth_required: boolean;
  configured_key_id: string | null;
  status: "not_configured" | "configured" | "update_available";
};
type VersionNotice = { current: string; latest: string };
const kinds = ["all", "fact", "preference", "episode", "procedure", "message"];
type Language = "zh";
const kindLabels: Record<string, string> = {
  all: "全部",
  fact: "事实",
  preference: "偏好",
  episode: "事件",
  procedure: "方法",
  message: "对话",
};
type View =
  | "all"
  | "timeline"
  | "archive"
  | "preferences"
  | "projects"
  | "tags"
  | "settings"
  | "mcp";
const viewCopy: Record<View, { title: string; description: string }> = {
  all: {
    title: "全部记忆",
    description:
      "一个安静、可检索的空间，保存 Agent 需要记住的事实、偏好和经验。",
  },
  timeline: { title: "时间线", description: "按发生和写入时间回看你的记忆。" },
  archive: { title: "归档", description: "被归档的记忆会集中显示在这里。" },
  preferences: {
    title: "偏好与习惯",
    description: "集中查看 Agent 需要遵循的个人偏好和习惯。",
  },
  projects: {
    title: "Scope 分类",
    description: "按 scope 分类查看记忆，项目目录名只是其中一种常用值。",
  },
  tags: { title: "标签", description: "标签视图将在记忆拥有标签后显示内容。" },
  settings: { title: "设置", description: "本地存储和界面设置。" },
  mcp: {
    title: "MCP 服务",
    description: "把 Memory One 连接到你的 Agent，查看端点配置和可用工具。",
  },
};
const viewRoutes = {
  all: "/",
  timeline: "/timeline",
  archive: "/archive",
  preferences: "/preferences",
  projects: "/scopes",
  tags: "/tags",
  settings: "/settings",
  mcp: "/mcp-service",
} as const satisfies Record<View, string>;
const viewByPath = Object.fromEntries(
  Object.entries(viewRoutes).map(([view, path]) => [path, view]),
) as Record<string, View>;

function EmptyRoute() {
  return null;
}
const rootRoute = createRootRoute({ component: App });
const routeTree = rootRoute.addChildren([
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: EmptyRoute,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/timeline",
    component: EmptyRoute,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/archive",
    component: EmptyRoute,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/preferences",
    component: EmptyRoute,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/scopes",
    component: EmptyRoute,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/tags",
    component: EmptyRoute,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/settings",
    component: EmptyRoute,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/mcp-service",
    component: EmptyRoute,
  }),
]);
const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
const ui = {
  zh: {
    brandSubtitle: "个人记忆库",
    workspace: "工作区",
    collections: "集合",
    connect: "连接",
    navAll: "全部记忆",
    navTimeline: "时间线",
    navArchive: "归档",
    navPreferences: "偏好与习惯",
    navScopes: "Scope 分类",
    navTags: "标签",
    navMcp: "MCP 服务",
    navSettings: "设置",
    localStorage: "本地存储",
    memories: "MEMORIES",
    scopes: "SCOPES",
    scopesNote: "分类数量",
    lastSync: "LAST SYNC",
    justNow: "刚刚",
    localDatabase: "本地数据库",
    localOnly: "完全本地",
    localOnlyDesc: "你的记忆只留在这台设备",
    newMemory: "新建记忆",
    search: "搜索记忆...",
    allScopes: "所有 Scope",
    reading: "读取中...",
    countSuffix: "条记忆",
    sortRecent: "按最近更新排序",
    sortTimeline: "按发生时间排序",
    sortGrouped: "按 Scope 分组",
    globalMemory: "全局记忆",
    emptyMatch: "这里还没有匹配的记忆",
    emptyHelp: "试试换一个关键词，或创建一条新的记忆。",
    loadFailed: "记忆读取失败",
    retry: "重试",
    noArchive: "暂无归档记忆",
    noTags: "暂无标签",
    settingsManaged: "设置已由本地配置管理",
    detailEyebrow: "记忆详情",
    close: "关闭",
    detailEmpty: "选择一条记忆",
    detailEmptyDesc: "查看完整内容、来源和元数据",
    confidence: "置信度",
    created: "创建时间",
    updated: "最后更新",
    source: "来源",
    agentWritten: "Agent 写入",
    scope: "Scope",
    signals: "信号",
    importance: "重要性",
    recallCount: "召回次数",
    times: "次",
    original: "查看原始记录",
    switchLanguage: "Switch to English",
    newMemoryEyebrow: "新建记忆",
    composerTitle: "保存一条记忆",
    content: "记忆内容",
    contentPlaceholder: "例如：用户偏好使用简洁的工具界面。",
    type: "类型",
    scopeOptional: "可选，例如：/path/to/project",
    sourcePlaceholder: "例如：Claude Code / 手动添加",
    writeLocal: "写入本地 SQLite",
    cancel: "取消",
    save: "保存记忆",
    languageCode: "EN",
    mcpKicker: "Agent 集成",
    mcpTitle: "连接你的 Agent",
    mcpDescription:
      "Memory One 通过 Streamable HTTP 提供记忆工具。创建一个按工具授权的 Key 后，把带 Authorization Header 的配置加入 MCP 客户端。",
    mcpOnline: "HTTP 在线",
    mcpEndpoint: "服务地址",
    mcpCopyEndpoint: "复制服务地址",
    transport: "传输方式",
    auth: "认证",
    noAuth: "必须使用 Bearer Key",
    category: "记忆分类",
    categoryValue: "全局 / 可选 scope",
    toolsLabel: "可用工具",
    toolsTitle: "Agent 可以使用的工具",
    toolsCount: "个工具",
    http: "HTTP",
    localMemory: "本地记忆 / 01",
    serverEndpoint: "服务端点",
  },
} as const;
const formatDate = (value: string | null | undefined, language: Language) =>
  value
    ? new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value))
    : language === "zh"
      ? "未标记时间"
      : "No date";

function App() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const navigate = useNavigate();
  const view = viewByPath[pathname] ?? "all";
  const [memories, setMemories] = useState<Memory[]>([]);
  const [selected, setSelected] = useState<Memory | null>(null);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [project, setProject] = useState("all");
  const language: Language = "zh";
  const [dark, setDark] = useState(
    () => localStorage.getItem("memory-one-theme") === "dark",
  );
  const [showComposer, setShowComposer] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [versionNotice, setVersionNotice] = useState<VersionNotice | null>(null);
  const load = async (search = query) => {
    setLoading(true);
    setLoadError(false);
    try {
      const endpoint = search.trim()
        ? `/api/search?query=${encodeURIComponent(search)}`
        : "/api/memories?limit=100";
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error("memory_load_failed");
      setMemories(await response.json());
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };
  const copy = ui[language];
  const labels = kindLabels;
  useEffect(() => {
    setSelected(null);
    setMobileNav(false);
    setQuery("");
    setKind(view === "preferences" ? "preference" : "all");
    setProject("all");
    void load("");
  }, [view]);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("memory-one-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    document.documentElement.lang = "zh-CN";
  }, []);
  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    void fetch("/api/version")
      .then((response) => response.ok ? response.json() as Promise<{ current?: string; latest?: string | null; updateAvailable?: boolean }> : null)
      .then((version) => {
        if (!active || !version?.updateAvailable || !version.current || !version.latest) return;
        setVersionNotice({ current: version.current, latest: version.latest });
        timer = window.setTimeout(() => setVersionNotice(null), 3000);
      })
      .catch(() => undefined);
    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
    };
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>("#memory-search")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const projects = useMemo(
    () => [
      "all",
      ...new Set(
        memories.map((item) => item.project).filter(Boolean) as string[],
      ),
    ],
    [memories],
  );
  const filtered = memories.filter((item) => {
    if (
      view === "archive" ||
      view === "tags" ||
      view === "settings" ||
      view === "mcp"
    )
      return false;
    if (view === "preferences" && item.kind !== "preference") return false;
    if (view === "projects" && !item.project) return false;
    return (
      (kind === "all" || item.kind === kind) &&
      (project === "all" || item.project === project)
    );
  });
  const memoryGroups = useMemo(() => {
    const groups = new Map<string, Memory[]>();
    for (const item of filtered) {
      const key = item.project ?? "__global__";
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    return [...groups.entries()];
  }, [filtered]);
  const stats = {
    total: memories.length,
    projects: new Set(memories.map((item) => item.project).filter(Boolean))
      .size,
    preferences: memories.filter((item) => item.kind === "preference").length,
  };
  const activeCopy = viewCopy[view];
  const selectView = (nextView: View) => {
    void navigate({ to: viewRoutes[nextView] });
  };
  const createMemory = async (payload: {
    content: string;
    kind: string;
    project: string;
    source: string;
  }) => {
    const response = await fetch("/api/memories", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...payload,
        project: payload.project || null,
        source: payload.source || null,
      }),
    });
    const memory = await response.json();
    setMemories((current) => [memory, ...current]);
    setSelected(memory);
    setShowComposer(false);
  };
  return (
    <div className={`app-shell ${view === "mcp" ? "app-shell-wide" : ""}`}>
      {versionNotice && (
        <div className="version-notice" role="status">
          <Sparkles size={14} />
          <span>发现新版本 {versionNotice.latest}，当前版本 {versionNotice.current}</span>
        </div>
      )}
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <Brain size={17} />
          </div>
          <div>
            <strong>Memory One</strong>
            <span>{copy.brandSubtitle}</span>
          </div>
          <button
            className="icon-button mobile-close"
            onClick={() => setMobileNav(false)}
            title={copy.close}
          >
            <X size={17} />
          </button>
        </div>
        <NavSection title={copy.workspace}>
          <NavItem
            icon={<BookOpen size={17} />}
            label={copy.navAll}
            count={stats.total}
            active={view === "all"}
            onClick={() => selectView("all")}
          />
          <NavItem
            icon={<Clock3 size={17} />}
            label={copy.navTimeline}
            active={view === "timeline"}
            onClick={() => selectView("timeline")}
          />
          <NavItem
            icon={<Archive size={17} />}
            label={copy.navArchive}
            active={view === "archive"}
            onClick={() => selectView("archive")}
          />
        </NavSection>
        <NavSection title={copy.collections}>
          <NavItem
            icon={<Sparkles size={17} />}
            label={copy.navPreferences}
            count={stats.preferences}
            active={view === "preferences"}
            onClick={() => selectView("preferences")}
          />
          <NavItem
            icon={<Layers3 size={17} />}
            label={copy.navScopes}
            count={stats.projects}
            active={view === "projects"}
            onClick={() => selectView("projects")}
          />
          <NavItem
            icon={<Tag size={17} />}
            label={copy.navTags}
            active={view === "tags"}
            onClick={() => selectView("tags")}
          />
        </NavSection>
        <NavSection title={copy.connect}>
          <NavItem
            icon={<Server size={17} />}
            label={copy.navMcp}
            active={view === "mcp"}
            onClick={() => selectView("mcp")}
          />
        </NavSection>
        <div className="sidebar-footer">
          <div className="storage-status">
            <span className="status-dot" />
            {copy.localStorage}
            <span className="mono">SQLite</span>
          </div>
          <NavItem
            icon={<Settings2 size={17} />}
            label={copy.navSettings}
            active={view === "settings"}
            onClick={() => selectView("settings")}
          />
        </div>
      </aside>
      {mobileNav && (
        <button
          className="sidebar-backdrop"
          onClick={() => setMobileNav(false)}
          aria-label={copy.close}
        />
      )}
      <main className="main-content">
        <header className="topbar">
          <button
            className="icon-button menu-button"
            onClick={() => setMobileNav(true)}
            title="打开菜单"
            aria-label="打开菜单"
          >
            <Menu size={19} />
          </button>
          <div className="breadcrumbs">
            <span>{copy.workspace}</span>
            <ChevronDown size={14} />
            <strong>{activeCopy.title}</strong>
          </div>
          <div className="top-actions">
            <button
              className="icon-button"
              onClick={() => setDark((value) => !value)}
              title={dark ? "切换浅色模式" : "切换深色模式"}
            >
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <div className="avatar">C</div>
          </div>
        </header>
        <div className="content-wrap">
          {view === "mcp" ? (
            <McpPage language={language} />
          ) : view === "settings" ? (
            <SettingsPage dark={dark} onToggleTheme={() => setDark((value) => !value)} />
          ) : (
            <>
              <section className="page-heading">
                <div>
                  <div className="heading-kicker">
                    <span className="live-dot" />
                    {copy.localMemory}
                  </div>
                  <h1>{activeCopy.title}</h1>
                  <p>{activeCopy.description}</p>
                </div>
                <button
                  className="primary-button"
                  onClick={() => setShowComposer(true)}
                >
                  <Plus size={17} />
                  {copy.newMemory}
                </button>
              </section>
              {view !== "timeline" && <section className="stat-grid">
                <Stat
                  label={copy.memories}
                  value={stats.total.toString().padStart(2, "0")}
                  note="已保存"
                />
                <Stat
                  label={copy.scopes}
                  value={stats.projects.toString().padStart(2, "0")}
                  note={copy.scopesNote}
                />
                <Stat
                  label={copy.lastSync}
                  value={copy.justNow}
                  note={copy.localDatabase}
                  date
                />
                <div className="stat-card stat-callout">
                  <Database size={19} />
                  <div>
                    <strong>{copy.localOnly}</strong>
                    <span>{copy.localOnlyDesc}</span>
                  </div>
                </div>
              </section>}
              <section className="toolbar">
                <div className="search-box">
                  <Search size={17} />
                  <input
                    id="memory-search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") load();
                    }}
                    placeholder={copy.search}
                  />
                  <kbd>
                    <Command size={11} />K
                  </kbd>
                </div>
                <div className="toolbar-actions">
                  <div className="select-wrap">
                    <Filter size={15} />
                    <Select
                      value={kind}
                      onValueChange={setKind}
                      options={kinds.map((value) => ({
                        value,
                        label: labels[value],
                      }))}
                      ariaLabel={copy.type}
                    />
                  </div>
                  <div className="select-wrap project-select">
                    <Select
                      value={project}
                      onValueChange={setProject}
                      options={projects.map((value) => ({
                        value,
                        label: value === "all" ? copy.allScopes : value,
                      }))}
                      ariaLabel={copy.scope}
                    />
                  </div>
                </div>
              </section>
              <div className="list-header">
                <span>
                  {loading
                    ? copy.reading
                    : `${filtered.length}${copy.countSuffix}`}
                </span>
                <span className="mono">
                  {view === "timeline"
                    ? copy.sortTimeline
                    : view === "all" && project === "all"
                      ? copy.sortGrouped
                      : copy.sortRecent}
                </span>
              </div>
              <section className={view === "timeline" ? "timeline-list" : "memory-list"}>
                {loadError && !loading && (
                  <div className="empty-state">
                    <FileText size={28} />
                    <strong>{copy.loadFailed}</strong>
                    <button className="ghost-button" onClick={() => void load()}>{copy.retry}</button>
                  </div>
                )}
                {!loadError && !loading && filtered.length === 0 && (
                  <div className="empty-state">
                    <FileText size={28} />
                    <strong>
                      {view === "archive"
                        ? copy.noArchive
                        : view === "tags"
                          ? copy.noTags
                          : view === "settings"
                            ? copy.settingsManaged
                            : copy.emptyMatch}
                    </strong>
                    <span>
                      {view === "archive" ||
                      view === "tags" ||
                      view === "settings"
                        ? activeCopy.description
                        : copy.emptyHelp}
                    </span>
                  </div>
                )}
                {!loadError && view === "timeline" && (
                  <TimelineEvents
                    items={filtered}
                    selectedId={selected?.id}
                    onSelect={setSelected}
                    language={language}
                  />
                )}
                {!loadError && view !== "timeline" && (view === "all" && project === "all"
                  ? memoryGroups.map(([group, items]) => (
                      <div className="memory-group" key={group}>
                        <div className="memory-group-header">
                          <span>
                            {group === "__global__" ? copy.globalMemory : group}
                          </span>
                          <span className="mono">
                            {items.length.toString().padStart(2, "0")}
                          </span>
                        </div>
                        {items.map((item) => (
                          <MemoryCard
                            key={item.id}
                            item={item}
                            selected={selected?.id === item.id}
                            onClick={() => setSelected(item)}
                            language={language}
                          />
                        ))}
                      </div>
                    ))
                  : filtered.map((item) => (
                      <MemoryCard
                        key={item.id}
                        item={item}
                        selected={selected?.id === item.id}
                        onClick={() => setSelected(item)}
                        language={language}
                      />
                    )))}
              </section>
            </>
          )}
        </div>
      </main>
      {view !== "mcp" && <aside className={`detail-panel ${selected ? "detail-open" : ""}`}>
        <div className="detail-header">
          <span className="eyebrow">{copy.detailEyebrow}</span>
          {selected && (
            <button
              className="icon-button"
              onClick={() => setSelected(null)}
              title={copy.close}
            >
              <X size={17} />
            </button>
          )}
        </div>
        {selected ? (
          <MemoryDetail item={selected} language={language} />
        ) : (
          <div className="detail-empty">
            <div className="detail-icon">
              <ArrowUpRight size={20} />
            </div>
            <strong>{copy.detailEmpty}</strong>
            <span>{copy.detailEmptyDesc}</span>
          </div>
        )}
      </aside>}
      {showComposer && (
        <Composer
          onClose={() => setShowComposer(false)}
          onCreate={createMemory}
          language={language}
        />
      )}
      <Outlet />
    </div>
  );
}
function NavSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="sidebar-section">
      <span className="eyebrow">{title}</span>
      {children}
    </div>
  );
}
function NavItem({
  icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`nav-item ${active ? "active" : ""}`}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
    >
      {icon}
      <span>{label}</span>
      {count !== undefined && <b>{count}</b>}
    </button>
  );
}
const mcpTools = [
  [
    "memory_store",
    "Store durable memory with optional scope.",
    "保存一条持久记忆，可选 scope 分类。",
  ],
  [
    "memory_search",
    "Search memories with SQLite FTS5 and an optional scope filter.",
    "使用 SQLite FTS5 搜索记忆，可按 scope 筛选。",
  ],
  [
    "memory_get_context",
    "Retrieve relevant experience before every task.",
    "在每项任务开始前检索相关经验。",
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
    "更新记忆内容或元数据。",
  ],
  ["memory_delete", "Soft-delete a memory.", "软删除一条记忆。"],
  [
    "memory_feedback",
    "Record whether a memory was useful.",
    "记录记忆是否有帮助的相关性信号。",
  ],
] as const;

function timelineDay(value: string | null | undefined, language: Language) {
  if (!value) return language === "zh" ? "未标记日期" : "Undated";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return language === "zh" ? "未标记日期" : "Undated";
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

function timelineTime(value: string | null | undefined, language: Language) {
  if (!value) return language === "zh" ? "未标记时间" : "No time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return language === "zh" ? "未标记时间" : "No time";
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function TimelineEvents({
  items,
  selectedId,
  onSelect,
  language,
}: {
  items: Memory[];
  selectedId?: string;
  onSelect: (item: Memory) => void;
  language: Language;
}) {
  const groups = useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      const aTime = new Date(a.occurred_at ?? a.created_at).getTime();
      const bTime = new Date(b.occurred_at ?? b.created_at).getTime();
      return bTime - aTime;
    });
    const grouped = new Map<string, Memory[]>();
    for (const item of sorted) {
      const value = item.occurred_at ?? item.created_at;
      const date = value ? new Date(value) : null;
      const key = date && !Number.isNaN(date.getTime())
        ? date.toISOString().slice(0, 10)
        : "undated";
      grouped.set(key, [...(grouped.get(key) ?? []), item]);
    }
    return [...grouped.entries()];
  }, [items]);

  return (
    <div className="timeline-stream">
      {groups.map(([day, dayItems]) => (
        <section className="timeline-day" key={day}>
          <header className="timeline-day-heading">
            <time>{timelineDay(day === "undated" ? null : day, language)}</time>
            <span className="mono">{dayItems.length.toString().padStart(2, "0")} 条</span>
          </header>
          <div className="timeline-day-items">
            {dayItems.map((item) => {
              const eventDate = item.occurred_at ?? item.created_at;
              return (
                <button
                  className={`timeline-event ${selectedId === item.id ? "selected" : ""}`}
                  key={item.id}
                  onClick={() => onSelect(item)}
                >
                  <span className="timeline-event-rail" aria-hidden="true">
                    <span className="timeline-dot" />
                  </span>
                  <span className="timeline-event-body">
                    <span className="timeline-event-meta">
                      <span className={`kind-badge kind-${item.kind}`}>
                        {kindLabels[item.kind] ?? item.kind}
                      </span>
                      <time>{timelineTime(eventDate, language)}</time>
                    </span>
                    <strong>{item.content}</strong>
                    <span className="timeline-event-context">
                      {item.project ?? item.scope}
                      <span aria-hidden="true">·</span>
                      {item.source ?? "Agent 写入"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function McpPage({ language }: { language: Language }) {
  const copy = ui[language];
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
    fetch("/api/mcp/keys")
      .then((response) => response.json())
      .then(setMcpKeys);
  }, []);
  useEffect(() => {
    const availableKeys = mcpKeys.filter((key) => key.secret);
    if (codexMcpIntegration?.configured_key_id) setCodexMcpKeyId(codexMcpIntegration.configured_key_id);
    else if (!availableKeys.some((key) => key.id === codexMcpKeyId)) setCodexMcpKeyId(availableKeys[0]?.id ?? "");
  }, [codexMcpIntegration, codexMcpKeyId, mcpKeys]);
  const updateBearerKey = async (enabled: boolean) => {
    setUseBearerKey(enabled);
    await fetch("/api/mcp/config", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ use_bearer_key: enabled }) });
    const response = await fetch(`/api/integrations/codex/mcp?endpoint=${encodeURIComponent(endpoint)}`);
    setCodexMcpIntegration(await response.json());
  };
  const copyText = async (value: string, key: string) => {
    try {
      if (!navigator.clipboard) throw new Error("clipboard_unavailable");
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setCopyMessage("已复制到剪贴板");
      window.setTimeout(() => setCopied(null), 1500);
      window.setTimeout(() => setCopyMessage(null), 2200);
    } catch {
      setCopyMessage("复制失败，请手动复制");
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
      setCodexMessage("全局指令已写入。重新启动 Codex 或开启新会话后生效。");
    } catch {
      setCodexMessage("写入失败，请检查 Codex 配置目录的访问权限。");
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
      setCodexMcpMessage("Codex MCP 配置已写入。重新启动 Codex 或开启新会话后生效。");
    } catch {
      setCodexMcpMessage(useBearerKey === true ? "配置失败，请检查 Codex 配置目录和 MCP Key。" : "配置失败，请检查 Codex 配置目录。");
    } finally {
      setCodexMcpInstalling(false);
    }
  };
  const createMcpKey = async () => {
    setKeyBusy(true);
    setKeyMessage("");
    try {
      const response = await fetch("/api/mcp/keys", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: keyName.trim() || "未命名 Key", allowed_tools: keyTools }) });
      if (!response.ok) throw new Error("create_key_failed");
      const result = (await response.json()) as { key: string; key_record: McpKey };
      setMcpKeys((current) => [result.key_record, ...current]);
      setNewKeySecret(result.key);
      setKeyName("");
    } catch {
      setKeyMessage("Key 创建失败，请稍后重试。");
    } finally {
      setKeyBusy(false);
    }
  };
  const revokeMcpKey = async (id: string) => {
    const key = mcpKeys.find((item) => item.id === id);
    if (!key || !window.confirm(`确定删除 Key“${key.name}”吗？删除后将立即失效，且无法恢复。`)) return;
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
  const keyConfig = newKeySecret ? JSON.stringify({ mcpServers: { "memory-one": { type: "http", url: endpoint, headers: { Authorization: `Bearer ${newKeySecret}` } } } }, null, 2) : "";
  const codexStatus =
    codexIntegration?.status === "configured"
      ? "已配置"
      : codexIntegration?.status === "update_available"
        ? "可更新"
        : "未配置";
  const codexButton =
    codexIntegration?.status === "update_available"
      ? "更新全局指令"
      : "启用全局记忆";
  const codexMcpConfigured = codexMcpIntegration?.status === "configured" && (useBearerKey !== true || codexMcpIntegration.configured_key_id === codexMcpKeyId);
  const codexMcpStatus =
    codexMcpIntegration?.status === "configured"
      ? "已配置"
      : codexMcpIntegration?.status === "update_available"
        ? "需更新"
        : "未配置";
  return (
    <div className={`mcp-page ${useBearerKey === null ? "mcp-loading" : ""}`}>
      {copyMessage ? <div className={`copy-feedback ${copyMessage.startsWith("复制失败") ? "error" : ""}`} role="status">{copyMessage.startsWith("复制失败") ? <AlertCircle size={14} /> : <Check size={14} />}{copyMessage}</div> : null}
      <div className="mcp-navigation">
      <nav className="mcp-tabs" role="tablist" aria-label="MCP 页面">
        <button className={activeTab === "connection" ? "active" : ""} role="tab" aria-selected={activeTab === "connection"} onClick={() => setActiveTab("connection")}><Server size={15} />连接配置</button>
        <button className={activeTab === "usage" ? "active" : ""} role="tab" aria-selected={activeTab === "usage"} onClick={() => setActiveTab("usage")}><Activity size={15} />调用统计</button>
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
            <span><i className="status-dot" />Streamable HTTP</span>
            <label className="switch-label"><span>Bearer Key</span><input type="checkbox" checked={useBearerKey === true} disabled={useBearerKey === null} onChange={(event) => updateBearerKey(event.target.checked)} /><i /></label>
          </div>
        </section>
        <section className="mcp-panel codex-mcp-panel">
          <span className="eyebrow codex-compact-heading">Codex</span>
          <div className="codex-compact-list">
            <section className="codex-compact-row">
              <div className="codex-compact-copy">
                <div className="codex-compact-title"><strong>MCP 连接</strong><span className={`integration-status status-${codexMcpIntegration?.status ?? "loading"}`}>{codexMcpIntegration ? codexMcpStatus : "检测中"}</span></div>
                <p>{useBearerKey === true ? "选择 Key 后自动写入连接配置。" : useBearerKey === false ? "自动写入连接配置。" : "正在读取认证状态。"}</p>
                {codexMcpMessage ? <div className="integration-message" role="status">{codexMcpMessage}</div> : null}
              </div>
              <div className="codex-compact-actions">
                {useBearerKey === true ? <select aria-label="MCP Key" value={codexMcpKeyId} onChange={(event) => setCodexMcpKeyId(event.target.value)} disabled={!mcpKeys.some((key) => key.secret)}>
                {mcpKeys.filter((key) => key.secret).map((key) => <option key={key.id} value={key.id}>{key.name} · {key.prefix}••••</option>)}
                {!mcpKeys.some((key) => key.secret) ? <option value="">请先创建 MCP Key</option> : null}
                </select> : null}
                <button className="primary-button" disabled={useBearerKey === null || !codexMcpIntegration || (useBearerKey === true && !codexMcpKeyId) || codexMcpInstalling || codexMcpConfigured} onClick={() => void installCodexMcp()}>{codexMcpInstalling ? <LoaderCircle className="spin" size={16} /> : <Server size={16} />}{codexMcpConfigured ? "已配置" : codexMcpIntegration?.status === "not_configured" ? "配置" : "更新"}</button>
              </div>
            </section>
            <section className="codex-compact-row">
              <div className="codex-compact-copy">
                <div className="codex-compact-title"><strong>任务前置记忆</strong><span className={`integration-status status-${codexIntegration?.status ?? "loading"}`}>{codexIntegration ? codexStatus : "读取中"}</span></div>
                <p>让 Codex 在每项任务开始前读取相关经验。</p>
                {codexMessage ? <div className="integration-message" role="status">{codexMessage}</div> : null}
              </div>
              <button className="primary-button" disabled={!codexIntegration || codexInstalling || codexIntegration.status === "configured"} onClick={installCodex}>{codexInstalling ? <LoaderCircle className="spin" size={16} /> : <FileCog size={16} />}{codexIntegration?.status === "configured" ? "已启用" : codexButton}</button>
            </section>
          </div>
        </section>
        {useBearerKey === true && <section className="mcp-keys" role="region" aria-label="Key 管理">
          <div className="mcp-tools-heading"><div><span className="eyebrow">访问控制</span><h2>MCP Key 管理</h2></div><KeyRound size={18} /></div>
          <p className="mcp-key-note">为平台 Agent、Codex 或其他 MCP 客户端创建独立 Key，并按最小权限限制它可以调用的工具。</p>
          <div className="mcp-key-create"><button className="primary-button" onClick={() => setShowKeyForm(true)}><KeyRound size={15} />创建 Key</button></div>
          {newKeySecret ? <div className="mcp-key-secret"><strong>Key 已创建，可随时在下方再次复制</strong><code>{newKeySecret}</code><div><button className="icon-button" onClick={() => copyText(keyConfig, "key-config")} title="复制带 Key 的 MCP 配置">{copied === "key-config" ? <Check size={16} /> : <Copy size={16} />}</button><span>{copied === "key-config" ? "已复制配置" : "复制带 Authorization Header 的配置"}</span></div></div> : null}
          <div className="mcp-key-list">{mcpKeys.length ? mcpKeys.map((key) => <div className="mcp-key-row" key={key.id}><KeyRound size={15} /><div>{editingKeyId === key.id ? <input className="mcp-key-name-input" autoFocus value={editingKeyName} onChange={(event) => setEditingKeyName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void renameMcpKey(key.id); if (event.key === "Escape") setEditingKeyId(null); }} onBlur={() => void renameMcpKey(key.id)} /> : <strong>{key.name}</strong>}<code>{key.prefix}••••••••</code><span>{key.allowed_tools.length ? `可用工具 ${key.allowed_tools.length}/${mcpTools.length}` : "可调用全部工具"}{key.last_used_at ? ` · 最近使用 ${formatDate(key.last_used_at, language)}` : " · 尚未使用"}</span><div className="tool-chip-list key-tool-list">{(key.allowed_tools.length ? key.allowed_tools : mcpTools.map(([name]) => name)).map((name) => <span className="tool-chip" key={name}>{name}</span>)}</div></div><div className="mcp-key-actions">{key.secret ? <button className="icon-button" onClick={() => copyText(key.secret!, `key-${key.id}`)} title="复制 Key">{copied === `key-${key.id}` ? <Check size={14} /> : <Copy size={14} />}</button> : null}<button className="icon-button" onClick={() => { setEditingKeyId(key.id); setEditingKeyName(key.name); }} title="修改名称"><Pencil size={14} /></button><button className="ghost-button" onClick={() => void revokeMcpKey(key.id)}>删除</button></div></div>) : <p className="mcp-key-empty">还没有创建 Key。</p>}</div>
        </section>}
      </div>}
      {showKeyForm && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowKeyForm(false); }}><section className="key-create-modal" role="dialog" aria-modal="true" aria-label="创建 MCP Key">
        <div className="composer-header"><div><span className="eyebrow">访问控制</span><h2>创建 MCP Key</h2></div><button className="icon-button" onClick={() => setShowKeyForm(false)} title="关闭"><X size={18} /></button></div>
        <label className="config-field"><span>Key 名称</span><input autoFocus value={keyName} onChange={(event) => setKeyName(event.target.value)} placeholder="例如：平台 Agent" /></label>
        <div className="mcp-key-tools"><span className="key-tools-label">允许调用的工具</span><div className="key-tools-grid">{mcpTools.map(([name]) => <label key={name}><input type="checkbox" checked={keyTools.includes(name)} onChange={(event) => setKeyTools((current) => event.target.checked ? [...current, name] : current.filter((item) => item !== name))} />{name}</label>)}</div></div>
        <div className="modal-actions"><button className="ghost-button" onClick={() => setShowKeyForm(false)}>取消</button><button className="primary-button" onClick={() => { void createMcpKey(); setShowKeyForm(false); }} disabled={keyBusy || keyTools.length === 0}>{keyBusy ? <LoaderCircle className="spin" size={15} /> : <KeyRound size={15} />}创建 Key</button></div>
        {keyMessage ? <p className="integration-message" role="alert">{keyMessage}</p> : null}
      </section></div>}
      {activeTab === "usage" && <>
      <section className="mcp-usage" role="tabpanel">
        <div className="mcp-tools-heading">
          <div>
            <span className="eyebrow">调用统计</span>
            <h2>工具使用情况</h2>
          </div>
          <Activity size={18} />
        </div>
        <div className="mcp-metrics">
          <Stat
            label="TOTAL CALLS"
            value={stats ? String(stats.total_calls) : "--"}
            note="累计调用"
          />
          <Stat
            label="SUCCESS RATE"
            value={stats?.total_calls ? `${successRate}%` : "--"}
            note={stats ? `${stats.failed_calls} 次失败` : "读取中"}
          />
          <Stat
            label="AVG LATENCY"
            value={
              stats?.total_calls ? `${stats.average_duration_ms} ms` : "--"
            }
            note="平均处理耗时"
          />
          <Stat
            label="LAST CALL"
            value={
              stats?.last_called_at
                ? formatDate(stats.last_called_at, language)
                : "暂无"
            }
            note="最近一次调用"
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
                <code>{callsByTool.get(name) ?? 0} 次</code>
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
function Stat({
  label,
  value,
  note,
  date,
}: {
  label: string;
  value: string;
  note: string;
  date?: boolean;
}) {
  return (
    <div className="stat-card">
      <span className="stat-label">{label}</span>
      <strong className={date ? "stat-date" : ""}>{value}</strong>
      <span className="stat-note">{note}</span>
    </div>
  );
}
function MemoryCard({
  item,
  selected,
  onClick,
  language,
}: {
  item: Memory;
  selected: boolean;
  onClick: () => void;
  language: Language;
}) {
  const copy = ui[language];
  const labels = kindLabels;
  const confidence = Math.round(item.confidence * 100);
  return (
    <button
      className={`memory-card ${selected ? "selected" : ""}`}
      onClick={onClick}
    >
      <div className="card-top">
        <span className={`kind-badge kind-${item.kind}`}>
          {labels[item.kind] ?? item.kind}
        </span>
        <span className="card-date">
          {formatDate(item.occurred_at ?? item.created_at, language)}
        </span>
      </div>
      <p>{item.content}</p>
      <div className="card-bottom">
        <span>
          {item.project ? (
            <>
              <Layers3 size={13} />
              {item.project}
            </>
          ) : (
            <>
              <Tag size={13} />
              {item.scope}
            </>
          )}
        </span>
        <span className="recall-count">{item.recall_count ?? 0} 次召回</span>
        <span className="confidence">
          <span className="confidence-meter">
            <i style={{ width: `${confidence}%` }} />
          </span>
          <span>{copy.confidence}</span>
          <span>{confidence}%</span>
        </span>
      </div>
    </button>
  );
}
function MemoryDetail({
  item,
  language,
}: {
  item: Memory;
  language: Language;
}) {
  const copy = ui[language];
  const labels = kindLabels;
  return (
    <div className="detail-body">
      <div className={`detail-kind kind-badge kind-${item.kind}`}>
        {labels[item.kind] ?? item.kind}
      </div>
      <h2>{item.content}</h2>
      <div className="detail-meta">
        <div>
          <span>{copy.created}</span>
          <strong>{formatDate(item.created_at, language)}</strong>
        </div>
        <div>
          <span>{copy.updated}</span>
          <strong>{formatDate(item.updated_at, language)}</strong>
        </div>
        <div>
          <span>{copy.source}</span>
          <strong>{item.source ?? copy.agentWritten}</strong>
        </div>
        <div>
          <span>{copy.recallCount}</span>
          <strong>
            {item.recall_count ?? 0} {copy.times}
          </strong>
        </div>
      </div>
      <div className="detail-section">
        <span className="eyebrow">{copy.scope}</span>
        <div className="scope-value">
          <Database size={15} />
          {item.scope}
          {item.project && (
            <>
              <span>/</span>
              {item.project}
            </>
          )}
        </div>
      </div>
      <div className="detail-section">
        <span className="eyebrow">{copy.signals}</span>
        <Signal
          label={copy.importance}
          value={item.importance}
          language={language}
        />
        <Signal
          label={copy.confidence}
          value={item.confidence}
          language={language}
        />
      </div>
    </div>
  );
}
function Signal({
  label,
  value,
  language,
}: {
  label: string;
  value: number;
  language: Language;
}) {
  return (
    <div className="signal-row">
      <span>{label}</span>
      <div className="signal-track">
        <span style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
      <b>{Math.round(value * 100)}%</b>
    </div>
  );
}

function SettingsPage({
  dark,
  onToggleTheme,
}: {
  dark: boolean;
  onToggleTheme: () => void;
}) {
  return (
    <div className="settings-page">
      <section className="page-heading">
        <div>
          <div className="heading-kicker"><span className="live-dot" />本地工作区</div>
          <h1>设置</h1>
          <p>调整界面显示，并查看当前数据存储位置。</p>
        </div>
      </section>
      <section className="config-panel settings-panel">
        <div className="config-panel-heading">
          <div><span className="eyebrow">APPEARANCE</span><h2>界面显示</h2></div>
          {dark ? <Moon size={19} /> : <Sun size={19} />}
        </div>
        <div className="settings-row">
          <span><strong>深色模式</strong><small>在浅色和深色界面之间切换。</small></span>
          <button className="ghost-button" onClick={onToggleTheme}>{dark ? "切换浅色" : "切换深色"}</button>
        </div>
      </section>
      <section className="config-panel settings-panel">
        <div className="config-panel-heading">
          <div><span className="eyebrow">STORAGE</span><h2>本地存储</h2></div>
          <Database size={19} />
        </div>
        <div className="settings-storage"><span className="status-dot" /><strong>SQLite</strong><span>记忆仅保存在当前设备。</span></div>
      </section>
    </div>
  );
}

function Composer({
  onClose,
  onCreate,
  language,
}: {
  onClose: () => void;
  onCreate: (payload: {
    content: string;
    kind: string;
    project: string;
    source: string;
  }) => void;
  language: Language;
}) {
  const copy = ui[language];
  const labels = kindLabels;
  const [content, setContent] = useState("");
  const [kind, setKind] = useState("fact");
  const [project, setProject] = useState("");
  const [source, setSource] = useState("");
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="composer" role="dialog" aria-modal="true" aria-labelledby="composer-title">
        <div className="composer-header">
          <div>
            <span className="eyebrow">{copy.newMemoryEyebrow}</span>
            <h2 id="composer-title">{copy.composerTitle}</h2>
          </div>
          <button className="icon-button" onClick={onClose} title={copy.close}>
            <X size={18} />
          </button>
        </div>
        <label>
          {copy.content}
          <textarea
            autoFocus
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={copy.contentPlaceholder}
            rows={5}
          />
        </label>
        <div className="composer-grid">
          <label>
            {copy.type}
            <Select
              value={kind}
              onValueChange={setKind}
              options={kinds
                .slice(1)
                .map((value) => ({ value, label: labels[value] }))}
              ariaLabel={copy.type}
              className="composer-select"
            />
          </label>
          <label>
            {copy.scope}
            <input
              value={project}
              onChange={(event) => setProject(event.target.value)}
              placeholder={copy.scopeOptional}
            />
          </label>
        </div>
        <label>
          {copy.source}
          <input
            value={source}
            onChange={(event) => setSource(event.target.value)}
            placeholder={copy.sourcePlaceholder}
          />
        </label>
        <div className="composer-footer">
          <span>
            <Check size={14} />
            {copy.writeLocal}
          </span>
          <div>
            <button className="ghost-button" onClick={onClose}>
              {copy.cancel}
            </button>
            <button
              className="primary-button"
              disabled={!content.trim()}
              onClick={() => onCreate({ content, kind, project, source })}
            >
              {copy.save} <ArrowUpRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type AgentMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: Array<{ name: string; label: string; count?: number }>;
  created_at?: string;
};
type AgentSettings = {
  name: string;
  scope: string;
  provider: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  autoContext: boolean;
};

const defaultAgentSettings: AgentSettings = {
  name: "记忆管家",
  scope: "",
  provider: "",
  model: "",
  baseUrl: "",
  apiKey: "",
  autoContext: true,
};

const toAgentSettings = (value: Partial<AgentSettings> & { base_url?: string; api_key?: string; auto_context?: boolean }): AgentSettings => ({
  name: value.name ?? defaultAgentSettings.name,
  scope: value.scope ?? defaultAgentSettings.scope,
  provider: value.provider ?? defaultAgentSettings.provider,
  model: value.model ?? defaultAgentSettings.model,
  baseUrl: value.baseUrl ?? value.base_url ?? defaultAgentSettings.baseUrl,
  apiKey: value.apiKey ?? value.api_key ?? defaultAgentSettings.apiKey,
  autoContext: value.autoContext ?? value.auto_context ?? defaultAgentSettings.autoContext,
});

const isAgentConfigured = (settings: AgentSettings) =>
  Boolean(settings.baseUrl.trim() && settings.provider.trim() && settings.model.trim() && (settings.provider === "local" || settings.apiKey.trim()));

function AgentConfigForm({
  initial,
  onSaved,
}: {
  initial: AgentSettings;
  onSaved: (settings: AgentSettings) => Promise<void> | void;
}) {
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl);
  const [apiKey, setApiKey] = useState(initial.apiKey);
  const [model, setModel] = useState(initial.model);
  const [provider, setProvider] = useState(initial.provider);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [modelsBusy, setModelsBusy] = useState(false);
  const [modelMessage, setModelMessage] = useState("");
  const save = async () => {
    setSaving(true);
    setModelMessage("");
    try {
      const response = await fetch("/api/agent/config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: initial.name,
          scope: initial.scope,
          provider,
          model: model.trim(),
          base_url: baseUrl.trim(),
          api_key: apiKey.trim(),
          auto_context: initial.autoContext,
        }),
      });
      const result = (await response.json()) as Partial<AgentSettings> & { base_url?: string; api_key?: string; auto_context?: boolean; detail?: string };
      if (!response.ok) throw new Error(result.detail || "agent_config_save_failed");
      const next = toAgentSettings(result);
      setSaved(true);
      await onSaved(next);
      window.setTimeout(() => setSaved(false), 1800);
    } catch {
      setModelMessage("配置保存失败，请稍后重试。");
    } finally {
      setSaving(false);
    }
  };
  const fetchModels = async () => {
    setModelsBusy(true);
    setModelMessage("");
    try {
      const response = await fetch("/api/agent/models", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider, base_url: baseUrl || null, api_key: apiKey || null }),
      });
      const result = (await response.json()) as { models?: string[]; detail?: string };
      if (!response.ok) throw new Error(result.detail || "model_list_failed");
      const nextModels = Array.isArray(result.models) ? result.models : [];
      setModels(nextModels);
      setModel((current) => current.trim() || nextModels[0] || current);
      setModelMessage(nextModels.length ? `已获取 ${nextModels.length} 个模型` : "没有可用模型");
    } catch {
      setModels([]);
      setModelMessage("模型列表获取失败，请检查供应商、Base URL 和 API Key。");
    } finally {
      setModelsBusy(false);
    }
  };
  return (
    <form className="agent-config-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <div className="agent-config-scroll">
        <section className="agent-config-section">
          <div className="agent-config-fields">
            <label className="config-field"><span>Base URL</span><input required value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://api.example.com/v1" /></label>
            <label className="config-field"><span>API Key</span><input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="sk-..." autoComplete="off" /></label>
            <label className="config-field"><span>请求格式</span><Select value={provider} onValueChange={(value) => { setProvider(value); setModels([]); setModelMessage(""); }} options={[{ value: "openai", label: "OpenAI" }, { value: "anthropic", label: "Anthropic" }, { value: "openai-compatible", label: "OpenAI Compatible" }]} ariaLabel="请求格式" placeholder="选择请求格式" required disabled={saving} /></label>
            <label className="config-field"><span>模型</span><div className="model-field">{models.length ? <Select value={model} onValueChange={setModel} options={[...(model && !models.includes(model) ? [{ value: model, label: model }] : []), ...models.map((item) => ({ value: item, label: item }))]} ariaLabel="模型" placeholder="选择模型" required disabled={saving} /> : <input required value={model} onChange={(event) => setModel(event.target.value)} placeholder="选择或输入模型" />}<button type="button" className="ghost-button" onClick={() => void fetchModels()} disabled={modelsBusy || saving}>{modelsBusy ? <LoaderCircle className="spin" size={14} /> : "获取列表"}</button></div>{modelMessage ? <small className="model-message">{modelMessage}</small> : null}</label>
          </div>
        </section>
      </div>
      <div className="agent-config-actions"><button className="primary-button" type="submit" disabled={saving}>{saving ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />}{saving ? "保存中" : saved ? "已保存" : "保存配置"}</button></div>
    </form>
  );
}

function AgentChat({ onMemoryChanged }: { onMemoryChanged: () => void }) {
  const welcomeMessage: AgentMessage = {
    id: "welcome",
    role: "assistant",
    content: "你好，我是记忆管家。可以帮你搜索、保存、修改、删除记忆，也可以总结你的偏好和特点。",
  };
  const [settings, setSettings] = useState<AgentSettings>(defaultAgentSettings);
  const [tab, setTab] = useState<"chat" | "config">("config");
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [messages, setMessages] = useState<AgentMessage[]>([welcomeMessage]);
  const [draft, setDraft] = useState("");
  const [activeRequests, setActiveRequests] = useState(0);
  const [error, setError] = useState("");
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const messagesRef = useRef<AgentMessage[]>(messages);
  const configured = isAgentConfigured(settings);
  const sending = activeRequests > 0;

  const persistMessage = async (message: AgentMessage) => {
    await fetch("/api/agent/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: message.id, role: message.role, content: message.content, toolCalls: message.toolCalls ?? [] }) });
  };

  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useEffect(() => {
    let active = true;
    void fetch("/api/agent/config")
      .then(async (response) => {
        if (!response.ok) throw new Error("agent_config_load_failed");
        return (await response.json()) as Partial<AgentSettings> & { base_url?: string; api_key?: string; auto_context?: boolean };
      })
      .then((result) => {
        if (!active) return;
        const next = toAgentSettings(result);
        setSettings(next);
        setTab(isAgentConfigured(next) ? "chat" : "config");
      })
      .catch(() => undefined)
      .finally(() => { if (active) setSettingsLoaded(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    void fetch("/api/agent/messages").then((response) => response.ok ? response.json() : []).then((value: AgentMessage[]) => {
      if (Array.isArray(value) && value.length) setMessages(value);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", handleOutsidePointerDown);
    return () => document.removeEventListener("pointerdown", handleOutsidePointerDown);
  }, [open]);

  const processMessage = async (content: string, userMessage: AgentMessage) => {
    setActiveRequests((count) => count + 1);
    try {
      const assistantId = crypto.randomUUID();
      const assistantMessage = { id: assistantId, role: "assistant" as const, content: "", toolCalls: [] };
      setMessages((current) => [...current, assistantMessage]);
      void persistMessage(assistantMessage);
      setStreamingId(assistantId);
      let assistantContent = "";
      const response = await fetch("/api/agent/stream", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: content, user_message_id: userMessage.id, assistant_message_id: assistantId, provider: settings.provider, model: settings.model, base_url: settings.baseUrl || null, api_key: settings.apiKey || null, scope: settings.scope || null, auto_context: settings.autoContext, history: [...messagesRef.current, userMessage].slice(-12).map(({ role, content: text }) => ({ role, content: text })) }),
      });
      if (!response.ok || !response.body) throw new Error("agent_request_failed");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const toolCalls: NonNullable<AgentMessage["toolCalls"]> = [];
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        const chunks = buffer.split(/\r?\n\r?\n/); buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const eventName = chunk.match(/^event:\s*(.+)$/m)?.[1]?.trim() ?? "message";
          const dataLine = chunk.split(/\r?\n/).find((line) => line.startsWith("data:")); if (!dataLine) continue;
          const data = JSON.parse(dataLine.slice(5).trim());
          if (eventName === "delta") { assistantContent += String(data.text ?? ""); setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, content: assistantContent } : item)); }
          else if (eventName === "tool") { toolCalls.push(data as NonNullable<AgentMessage["toolCalls"]>[number]); setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, toolCalls: [...toolCalls] } : item)); }
          else if (eventName === "error") throw new Error(String(data.detail ?? "agent_request_failed"));
          else if (eventName === "done") setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, toolCalls: Array.isArray(data.toolCalls) ? data.toolCalls : toolCalls } : item));
        }
        if (done) break;
      }
      setStreamingId(null); void persistMessage({ id: assistantId, role: "assistant", content: assistantContent, toolCalls });
      if (toolCalls.some((tool) => ["memory_store", "memory_update", "memory_delete"].includes(tool.name))) onMemoryChanged();
    } catch (caught) {
      setStreamingId(null); const detail = caught instanceof Error ? caught.message : "";
      setError(detail === "missing_base_url" ? "请先填写 Base URL。" : detail === "missing_api_key" ? "请先完成 Agent 配置。" : detail.startsWith("provider_http_") ? "模型供应商请求失败，请检查供应商、模型和 Base URL。" : "暂时无法连接记忆管家，请稍后再试。");
    } finally {
      setActiveRequests((count) => Math.max(0, count - 1));
    }
  };

  const send = (value = draft) => {
    const content = value.trim();
    if (!content || !configured) return;
    if (content.toLowerCase() === "/new") {
      setDraft("");
      setError("");
      setStreamingId(null);
      setMessages([{ ...welcomeMessage, id: crypto.randomUUID() }]);
      return;
    }
    setDraft("");
    setError("");
    const userMessage = { id: crypto.randomUUID(), role: "user" as const, content };
    setMessages((current) => [...current, userMessage]);
    void persistMessage(userMessage);
    void processMessage(content, userMessage);
    /* try {
      const assistantId = crypto.randomUUID();
      const assistantMessage = { id: assistantId, role: "assistant" as const, content: "", toolCalls: [] };
      setMessages((current) => [...current, assistantMessage]);
      void persistMessage(assistantMessage);
      setStreamingId(assistantId);
      let assistantContent = "";
      const response = await fetch("/api/agent/stream", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: content,
          provider: settings.provider,
          model: settings.model,
          base_url: settings.baseUrl || null,
          api_key: settings.apiKey || null,
          scope: settings.scope || null,
          auto_context: settings.autoContext,
          history: [...messages, userMessage].slice(-12).map(({ role, content: text }) => ({ role, content: text })),
        }),
      });
      if (!response.ok || !response.body) throw new Error("agent_request_failed");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const toolCalls: NonNullable<AgentMessage["toolCalls"]> = [];
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        const chunks = buffer.split(/\r?\n\r?\n/);
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const eventName = chunk.match(/^event:\s*(.+)$/m)?.[1]?.trim() ?? "message";
          const dataLine = chunk.split(/\r?\n/).find((line) => line.startsWith("data:"));
          if (!dataLine) continue;
          const data = JSON.parse(dataLine.slice(5).trim());
          if (eventName === "delta") {
            assistantContent += String(data.text ?? "");
            setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, content: assistantContent } : item));
          }
          else if (eventName === "tool") { toolCalls.push(data as NonNullable<AgentMessage["toolCalls"]>[number]); setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, toolCalls: [...toolCalls] } : item)); }
          else if (eventName === "error") throw new Error(String(data.detail ?? "agent_request_failed"));
          else if (eventName === "done") { const finalCalls = Array.isArray(data.toolCalls) ? data.toolCalls : toolCalls; setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, toolCalls: finalCalls } : item)); }
        }
        if (done) break;
      }
      setStreamingId(null);
      void persistMessage({ id: assistantId, role: "assistant", content: assistantContent, toolCalls });
      if (toolCalls.some((tool) => ["memory_store", "memory_update", "memory_delete"].includes(tool.name))) onMemoryChanged();
    } catch (caught) {
      setStreamingId(null);
      const detail = caught instanceof Error ? caught.message : "";
      setError(detail === "missing_base_url" ? "请先填写 Base URL。" : detail === "missing_api_key" ? "请先完成 Agent 配置。" : detail.startsWith("provider_http_") ? "模型供应商请求失败，请检查供应商、模型和 Base URL。" : "暂时无法连接记忆管家，请稍后再试。");
    } finally { setActiveRequests((count) => Math.max(0, count - 1)); }
    */
  };
  const suggestions = ["总结我的特点", "搜索最近的项目约定", "记住我喜欢简洁的界面", "/new"];
  const openAgent = () => { setTab(isAgentConfigured(settings) ? "chat" : "config"); setOpen(true); };
  const streamingMessage = streamingId ? messages.find((message) => message.id === streamingId) : null;
  return (
    <div className={`agent-float ${open ? "agent-float-open" : ""}`}>
      <div className="agent-float-position">
        {!open && <button className="agent-float-button" onClick={openAgent} title={`打开${settings.name}`} aria-label={`打开${settings.name}`} disabled={!settingsLoaded}><Bot size={21} /></button>}
        {open && <section ref={panelRef} className="agent-panel" aria-label={settings.name}>
          <header className="agent-header">
            <div className="agent-title"><span className="agent-avatar"><Brain size={17} /></span><div><strong>{settings.name}</strong><span>通过 MCP 管理你的记忆</span></div></div>
            <button className="icon-button" onClick={() => setOpen(false)} title="收起" aria-label="收起"><ChevronDown size={18} /></button>
          </header>
          <div className="agent-tabs" role="tablist" aria-label="Agent 页面">
            <button role="tab" aria-selected={tab === "chat"} className={tab === "chat" ? "active" : ""} disabled={!configured} onClick={() => setTab("chat")}><MessageCircle size={14} />对话</button>
            <button role="tab" aria-selected={tab === "config"} className={tab === "config" ? "active" : ""} onClick={() => setTab("config")}><Settings2 size={14} />配置</button>
          </div>
          {tab === "config" ? <AgentConfigForm initial={settings} onSaved={(next) => { setSettings(next); setTab(isAgentConfigured(next) ? "chat" : "config"); }} /> : <>
            <div className="agent-messages">
              {messages.map((message) => <article className={`agent-message ${message.role}`} key={message.id}>
                {message.role === "user" || message.content ? <div className="agent-message-bubble">{message.role === "assistant" ? <Streamdown mode={streamingId === message.id ? "streaming" : "static"} isAnimating={streamingId === message.id} parseIncompleteMarkdown={streamingId === message.id} skipHtml>{message.content}</Streamdown> : <span className="agent-plain-text">{message.content}</span>}</div> : null}
                {message.toolCalls?.length ? <div className="agent-tool-calls">{message.toolCalls.filter((tool) => tool.name !== "memory_get_context" || (tool.count ?? 0) > 0).map((tool, index) => <span key={`${message.id}-tool-${index}`}><Check size={11} />{tool.label}{tool.count !== undefined ? ` · ${tool.count}` : ""}</span>)}</div> : null}
              </article>)}
              {sending && !streamingMessage?.content && <div className="agent-thinking" role="status" aria-label="正在处理"><LoaderCircle size={14} /><span className="agent-thinking-label">正在读取记忆并生成回复</span><i /><i /><i /></div>}
              {error && <p className="agent-error" role="alert">{error}</p>}
            </div>
            <div className="agent-suggestions">{suggestions.map((suggestion) => <button key={suggestion} onClick={() => void send(suggestion)}>{suggestion}</button>)}</div>
            <form className="agent-composer" onSubmit={(event) => { event.preventDefault(); void send(); }}><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder="告诉记忆管家你想做什么..." rows={1} /><button className="agent-send" type="submit" disabled={!draft.trim()} title="发送"><Send size={17} /></button></form>
          </>}
        </section>}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
