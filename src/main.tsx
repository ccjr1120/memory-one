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
type Language = "zh" | "en";
const kindLabels: Record<Language, Record<string, string>> = {
  zh: { all: "全部", fact: "事实", preference: "偏好", episode: "事件", procedure: "方法", message: "对话" },
  en: { all: "All", fact: "Fact", preference: "Preference", episode: "Episode", procedure: "Procedure", message: "Message" },
};
type View =
  | "all"
  | "timeline"
  | "preferences"
  | "projects"
  | "tags"
  | "settings"
  | "mcp";
const viewCopy: Record<Language, Record<View, { title: string; description: string }>> = {
  zh: {
    all: { title: "全部记忆", description: "保存 Agent 需要记住的事实、偏好和经验。" },
    timeline: { title: "时间线", description: "按发生和写入时间回看记忆。" },
    preferences: { title: "偏好与习惯", description: "查看 Agent 需要遵循的个人偏好和习惯。" },
    projects: { title: "Scope 分类", description: "按 scope 分类查看记忆。" },
    tags: { title: "标签", description: "按标签查看记忆。" },
    settings: { title: "设置", description: "调整界面语言和显示方式。" },
    mcp: { title: "MCP 服务", description: "连接 Agent，管理服务访问。" },
  },
  en: {
    all: { title: "All memories", description: "Facts, preferences, and experience for your agents to remember." },
    timeline: { title: "Timeline", description: "Review memories by when they happened or were saved." },
    preferences: { title: "Preferences", description: "Review preferences your agents should follow." },
    projects: { title: "Scopes", description: "Browse memories by scope." },
    tags: { title: "Tags", description: "Browse memories by tag." },
    settings: { title: "Settings", description: "Adjust language and display settings." },
    mcp: { title: "MCP service", description: "Connect agents and manage service access." },
  },
};
const viewRoutes = {
  all: "/",
  timeline: "/timeline",
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
    switchLanguage: "切换到 English",
    newMemoryEyebrow: "新建记忆",
    composerTitle: "保存一条记忆",
    content: "记忆内容",
    contentPlaceholder: "例如：用户偏好使用简洁的工具界面。",
    type: "类型",
    scopeOptional: "可选，例如：/path/to/project",
    sourcePlaceholder: "例如：Claude Code / 手动添加",
    writeLocal: "写入本地 SQLite",
    preferenceRecall: "召回方式",
    persistentPreference: "常驻偏好",
    conditionalPreference: "条件偏好",
    persistentPreferenceHint: "每次任务开始时固定返回",
    cancel: "取消",
    save: "保存记忆",
    languageCode: "EN",
    timelineItems: "条",
    languageName: "中文",
    languageTitle: "界面语言",
    languageDescription: "选择工作台使用的语言。",
    languageZh: "中文",
    languageEn: "English",
    languageSaved: "语言已更新",
    languageSaveFailed: "语言更新失败，请稍后重试。",
    setupTitle: "选择语言",
    setupDescription: "选择工作台使用的语言，之后可在设置中修改。",
    continue: "继续",
    savedNote: "已保存",
    savedCount: "已保存",
    openMenu: "打开菜单",
    toggleLight: "切换浅色模式",
    toggleDark: "切换深色模式",
    storageNote: "记忆仅保存在当前设备。",
    savedMemories: "已保存",
    countMemories: "条记忆",
    recallTimes: "次召回",
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
    versionNotice: (latest: string, current: string) => `发现新版本 ${latest}，当前版本 ${current}`,
    callCount: "次",
    appearance: "界面显示",
    appearanceEyebrow: "界面显示",
    darkMode: "深色模式",
    darkModeDescription: "在浅色和深色界面之间切换。",
    storageEyebrow: "本地存储",
    agentName: "记忆管家",
    agentDescription: "通过 MCP 管理你的记忆",
    collapse: "收起",
    agentPage: "Agent 页面",
    chat: "对话",
    configuration: "配置",
    processing: "正在处理",
    readingMemory: "正在读取记忆并生成回复",
    agentPlaceholder: "告诉记忆管家你想做什么...",
    send: "发送",
    requestFormat: "请求格式",
    chooseRequestFormat: "选择请求格式",
    model: "模型",
    chooseOrEnterModel: "选择或输入模型",
    fetchModels: "获取列表",
    saving: "保存中",
    saved: "已保存",
    saveConfiguration: "保存配置",
    configSaveFailed: "配置保存失败，请稍后重试。",
    missingBaseUrl: "请先填写 Base URL。",
    missingApiKey: "请先完成 Agent 配置。",
    providerRequestFailed: "模型供应商请求失败，请检查供应商、模型和 Base URL。",
    agentRequestFailed: "暂时无法连接记忆管家，请稍后再试。",
    fetchedModels: (count: number) => `已获取 ${count} 个模型`,
    noModels: "没有可用模型",
    modelListFailed: "模型列表获取失败，请检查配置。",
    welcome: "你好，我是记忆管家。可以帮你搜索、保存、修改、删除记忆，也可以总结你的偏好和特点。",
    suggestionTraits: "总结我的特点",
    suggestionProjects: "搜索最近的项目约定",
    suggestionConcise: "记住我喜欢简洁的界面",
    openAgent: "打开记忆管家",
    agentTabs: "Agent 页面",
  },
  en: {
    brandSubtitle: "Personal memory", workspace: "Workspace", collections: "Collections", connect: "Connect",
    navAll: "All memories", navTimeline: "Timeline", navPreferences: "Preferences", navScopes: "Scopes", navTags: "Tags", navMcp: "MCP service", navSettings: "Settings",
    localStorage: "Local storage", memories: "MEMORIES", scopes: "SCOPES", scopesNote: "Scope count", lastSync: "LAST SYNC", justNow: "Just now", localDatabase: "Local database", localOnly: "Local only", localOnlyDesc: "Your memories stay on this device", newMemory: "New memory", search: "Search memories...", allScopes: "All scopes", reading: "Loading...", countSuffix: " memories", sortRecent: "Sorted by recently updated", sortTimeline: "Sorted by event time", sortGrouped: "Grouped by scope", globalMemory: "Global memories", emptyMatch: "No matching memories", emptyHelp: "Try another search or create a memory.", loadFailed: "Could not load memories", retry: "Retry", noTags: "No tags", settingsManaged: "Managed by local settings", detailEyebrow: "Memory details", close: "Close", detailEmpty: "Select a memory", detailEmptyDesc: "View its content and metadata", confidence: "Confidence", created: "Created", updated: "Updated", source: "Source", agentWritten: "Agent", scope: "Scope", signals: "Signals", importance: "Importance", recallCount: "Recalls", times: "times", original: "View original", switchLanguage: "Switch to Chinese", languageCode: "中", timelineItems: "items",
    languageName: "English", languageTitle: "Interface language", languageDescription: "Choose the language used by the workspace.", languageZh: "中文", languageEn: "English", languageSaved: "Language updated", languageSaveFailed: "Could not update language. Try again.", setupTitle: "Choose a language", setupDescription: "Choose a language for the workspace. You can change it later in Settings.", continue: "Continue", savedNote: "Saved", savedCount: "Saved", openMenu: "Open menu", toggleLight: "Switch to light mode", toggleDark: "Switch to dark mode", storageNote: "Memories stay on this device.", savedMemories: "Saved", countMemories: " memories", recallTimes: " recalls",
    newMemoryEyebrow: "New memory", composerTitle: "Save a memory", content: "Memory", contentPlaceholder: "For example: The user prefers a concise interface.", type: "Type", scopeOptional: "Optional, for example: /path/to/project", sourcePlaceholder: "For example: Claude Code / Manual", writeLocal: "Save locally", preferenceRecall: "Recall mode", persistentPreference: "Persistent preference", conditionalPreference: "Conditional preference", persistentPreferenceHint: "Always returned at the start of every task", cancel: "Cancel", save: "Save memory", mcpKicker: "Agent integration", mcpTitle: "Connect your agent", mcpDescription: "Expose Memory One through Streamable HTTP. Create a scoped key and add it to your MCP client.", mcpOnline: "HTTP online", mcpEndpoint: "Service address", mcpCopyEndpoint: "Copy service address", transport: "Transport", auth: "Authentication", noAuth: "Bearer Key required", category: "Memory scope", categoryValue: "Global / optional scope", toolsLabel: "Available tools", toolsTitle: "Tools available to agents", toolsCount: "tools", http: "HTTP", localMemory: "LOCAL MEMORY / 01", serverEndpoint: "Service endpoint", versionNotice: (latest: string, current: string) => `New version ${latest}; current version ${current}`, callCount: "calls",
    appearance: "Appearance",
    appearanceEyebrow: "APPEARANCE",
    darkMode: "Dark mode",
    darkModeDescription: "Switch between light and dark themes.",
    storageEyebrow: "STORAGE",
    agentName: "Memory assistant",
    agentDescription: "Manage your memories through MCP",
    collapse: "Collapse",
    agentPage: "Agent page",
    chat: "Chat",
    configuration: "Configuration",
    processing: "Processing",
    readingMemory: "Reading memories and preparing a reply",
    agentPlaceholder: "Tell the memory assistant what to do...",
    send: "Send",
    requestFormat: "Request format",
    chooseRequestFormat: "Choose a request format",
    model: "Model",
    chooseOrEnterModel: "Choose or enter a model",
    fetchModels: "Fetch models",
    saving: "Saving",
    saved: "Saved",
    saveConfiguration: "Save configuration",
    configSaveFailed: "Could not save the configuration. Try again.",
    missingBaseUrl: "Enter a Base URL first.",
    missingApiKey: "Complete the agent configuration first.",
    providerRequestFailed: "The model provider request failed. Check the provider, model, and Base URL.",
    agentRequestFailed: "Could not connect to the memory assistant. Try again.",
    fetchedModels: (count: number) => `${count} models found`,
    noModels: "No models available",
    modelListFailed: "Could not fetch models. Check the configuration.",
    welcome: "Hi, I’m the memory assistant. I can search, save, update, and delete memories, or summarize your preferences.",
    suggestionTraits: "Summarize my preferences",
    suggestionProjects: "Search recent project conventions",
    suggestionConcise: "Remember that I prefer concise interfaces",
    openAgent: "Open memory assistant",
    agentTabs: "Agent page",
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
  const [language, setLanguage] = useState<Language>("zh");
  const [languageSetup, setLanguageSetup] = useState(false);
  const [dark, setDark] = useState(
    () => localStorage.getItem("memory-one-theme") === "dark",
  );
  const [showComposer, setShowComposer] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [versionNotice, setVersionNotice] = useState<VersionNotice | null>(null);
  const [currentVersion, setCurrentVersion] = useState("");
  const [languageReady, setLanguageReady] = useState(false);
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
  const labels = kindLabels[language];
  useEffect(() => {
    let active = true;
    void fetch("/api/app-config")
      .then((response) => response.ok ? response.json() as Promise<{ language?: Language | null }> : null)
      .then((config) => {
        if (!active) return;
        if (config?.language === "zh" || config?.language === "en") setLanguage(config.language);
        else setLanguageSetup(true);
        setLanguageReady(true);
      })
      .catch(() => { if (active) setLanguageReady(true); });
    return () => { active = false; };
  }, []);
  const saveLanguage = async (next: Language) => {
    const response = await fetch("/api/app-config", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ language: next }) });
    if (!response.ok) throw new Error("language_save_failed");
    setLanguage(next);
    setLanguageSetup(false);
  };
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
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  }, [language]);
  useEffect(() => {
    let active = true;
    void fetch("/api/version")
      .then((response) => response.ok ? response.json() as Promise<{ current?: string; latest?: string | null; updateAvailable?: boolean }> : null)
      .then((version) => {
        if (!active || !version?.current) return;
        setCurrentVersion(version.current);
        if (version.updateAvailable && version.latest) setVersionNotice({ current: version.current, latest: version.latest });
      })
      .catch(() => undefined);
    return () => {
      active = false;
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
      "__global__",
      ...new Set(
        memories.map((item) => item.project).filter(Boolean) as string[],
      ),
    ],
    [memories],
  );
  const filtered = memories.filter((item) => {
    if (
      view === "tags" ||
      view === "settings" ||
      view === "mcp"
    )
      return false;
    if (view === "preferences" && item.kind !== "preference") return false;
    return (
      (kind === "all" || item.kind === kind) &&
      (project === "all" || (project === "__global__" ? !item.project : item.project === project))
    );
  });
  const stats = {
    total: memories.length,
    projects: new Set(memories.map((item) => item.project).filter(Boolean))
      .size,
    preferences: memories.filter((item) => item.kind === "preference").length,
  };
  const activeCopy = viewCopy[language][view];
  const selectView = (nextView: View) => {
    void navigate({ to: viewRoutes[nextView] });
  };
  const createMemory = async (payload: {
    content: string;
    kind: string;
    project: string;
    source: string;
    alwaysInclude: boolean;
  }) => {
    const response = await fetch("/api/memories", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...payload,
        project: payload.project || null,
        source: payload.source || null,
        metadata: payload.kind === "preference" && payload.alwaysInclude ? { always_include: true } : {},
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
          <span>{copy.versionNotice(versionNotice.latest, versionNotice.current)}</span>
          <button
            className="icon-button"
            onClick={() => setVersionNotice(null)}
            title={copy.close}
            aria-label={copy.close}
          >
            <X size={14} />
          </button>
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
            count={currentVersion ? `v${currentVersion}` : undefined}
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
            title={copy.openMenu}
            aria-label={copy.openMenu}
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
              title={dark ? copy.toggleLight : copy.toggleDark}
              aria-label={dark ? copy.toggleLight : copy.toggleDark}
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
            <SettingsPage language={language} onLanguageChange={(next) => saveLanguage(next)} dark={dark} onToggleTheme={() => setDark((value) => !value)} />
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
                  note={copy.savedCount}
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
                        label: value === "all" ? copy.allScopes : value === "__global__" ? copy.globalMemory : value,
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
                      {view === "tags" ? copy.noTags : copy.emptyMatch}
                    </strong>
                    <span>
                      {view === "tags" ? activeCopy.description : copy.emptyHelp}
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
                {!loadError && view !== "timeline" && filtered.map((item) => (
                  <MemoryCard
                    key={item.id}
                    item={item}
                    selected={selected?.id === item.id}
                    onClick={() => setSelected(item)}
                    language={language}
                  />
                ))}
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
      {languageReady && languageSetup ? <LanguageSetup language={language} onSelect={(next) => saveLanguage(next)} /> : null}
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
  count?: number | string;
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
  const copy = ui[language];
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
                    <span className="mono">{dayItems.length.toString().padStart(2, "0")} {copy.timelineItems}</span>
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
                        {kindLabels[language][item.kind] ?? item.kind}
                      </span>
                      <time>{timelineTime(eventDate, language)}</time>
                    </span>
                    <strong>{item.content}</strong>
                    <span className="timeline-event-context">
                      {item.project ?? item.scope}
                      <span aria-hidden="true">·</span>
                      {item.source ?? ui[language].agentWritten}
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

const mcpCopy = {
  zh: {
    copied: "已复制到剪贴板",
    copyFailed: "复制失败，请手动复制",
    codexWritten: "Codex MCP 配置已写入。重新启动 Codex 或开启新会话后生效。",
    codexWriteFailed: "配置失败，请检查 Codex 配置目录。",
    codexGuidanceWritten: "全局指令已写入。重新启动 Codex 或开启新会话后生效。",
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
    taskMemoryDesc: "让 Codex 在每项任务开始前读取相关经验。",
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
    codexGuidanceWritten: "Global guidance saved. Restart Codex or start a new session to apply it.",
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
    taskMemoryDesc: "Have Codex read relevant experience before each task.",
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

function McpPage({ language }: { language: Language }) {
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
  const labels = kindLabels[language];
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
        <span className="recall-count">{item.recall_count ?? 0}{copy.recallTimes}</span>
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
  const labels = kindLabels[language];
  return (
    <div className="detail-body">
      <div className={`detail-kind kind-badge kind-${item.kind}`}>
        {labels[item.kind] ?? item.kind}
      </div>
      {item.kind === "preference" && item.metadata.always_include === true && (
        <div className="detail-kind kind-badge">{copy.persistentPreference}</div>
      )}
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

function LanguageSetup({ language, onSelect }: { language: Language; onSelect: (language: Language) => Promise<void> }) {
  const copy = ui[language];
  const [selected, setSelected] = useState<Language>(language);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await Promise.resolve(onSelect(selected));
    } catch {
      setError(copy.languageSaveFailed);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="modal-backdrop language-setup-backdrop">
      <section className="language-setup" role="dialog" aria-modal="true" aria-labelledby="language-setup-title">
        <span className="eyebrow">Memory One</span>
        <h2 id="language-setup-title">{copy.setupTitle}</h2>
        <p>{copy.setupDescription}</p>
        <div className="language-options">
          <button className={selected === "zh" ? "selected" : ""} onClick={() => setSelected("zh")}><strong>中文</strong><span>简体中文</span></button>
          <button className={selected === "en" ? "selected" : ""} onClick={() => setSelected("en")}><strong>English</strong><span>English</span></button>
        </div>
        {error ? <p className="settings-message" role="alert">{error}</p> : null}
        <button className="primary-button language-continue" onClick={() => void save()} disabled={saving}>{saving ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />}{copy.continue}</button>
      </section>
    </div>
  );
}

function SettingsPage({
  language,
  onLanguageChange,
  dark,
  onToggleTheme,
}: {
  language: Language;
  onLanguageChange: (language: Language) => Promise<void>;
  dark: boolean;
  onToggleTheme: () => void;
}) {
  const copy = ui[language];
  const [languageBusy, setLanguageBusy] = useState(false);
  const [languageMessage, setLanguageMessage] = useState("");
  const changeLanguage = async (next: Language) => {
    if (next === language) return;
    setLanguageBusy(true);
    setLanguageMessage("");
    try {
      await Promise.resolve(onLanguageChange(next));
      setLanguageMessage(ui[next].languageSaved);
    } catch {
      setLanguageMessage(copy.languageSaveFailed);
    } finally { setLanguageBusy(false); }
  };
  return (
    <div className="settings-page">
      <section className="page-heading">
        <div>
          <div className="heading-kicker"><span className="live-dot" />{copy.localMemory}</div>
          <h1>{viewCopy[language].settings.title}</h1>
          <p>{viewCopy[language].settings.description}</p>
        </div>
      </section>
      <section className="config-panel settings-panel">
        <div className="config-panel-heading">
          <div><span className="eyebrow">{copy.languageTitle}</span><h2>{copy.languageTitle}</h2></div>
          <span className="language-current">{language === "zh" ? "中文" : "English"}</span>
        </div>
        <div className="settings-row language-settings-row">
          <span><strong>{copy.languageTitle}</strong><small>{copy.languageDescription}</small></span>
          <div className="language-switch" role="group" aria-label={copy.languageTitle}>
            <button className={language === "zh" ? "selected" : ""} onClick={() => void changeLanguage("zh")} disabled={languageBusy}>中文</button>
            <button className={language === "en" ? "selected" : ""} onClick={() => void changeLanguage("en")} disabled={languageBusy}>English</button>
          </div>
        </div>
        {languageMessage ? <p className="settings-message" role="status">{languageMessage}</p> : null}
      </section>
      <section className="config-panel settings-panel">
        <div className="config-panel-heading">
          <div><span className="eyebrow">{copy.appearanceEyebrow}</span><h2>{copy.appearance}</h2></div>
          {dark ? <Moon size={19} /> : <Sun size={19} />}
        </div>
        <div className="settings-row">
          <span><strong>{copy.darkMode}</strong><small>{copy.darkModeDescription}</small></span>
          <button className="ghost-button" onClick={onToggleTheme}>{dark ? copy.toggleLight : copy.toggleDark}</button>
        </div>
      </section>
      <section className="config-panel settings-panel">
        <div className="config-panel-heading">
          <div><span className="eyebrow">{copy.storageEyebrow}</span><h2>{copy.localDatabase}</h2></div>
          <Database size={19} />
        </div>
        <div className="settings-storage"><span className="status-dot" /><strong>SQLite</strong><span>{copy.storageNote}</span></div>
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
    alwaysInclude: boolean;
  }) => void;
  language: Language;
}) {
  const copy = ui[language];
  const labels = kindLabels[language];
  const [content, setContent] = useState("");
  const [kind, setKind] = useState("fact");
  const [project, setProject] = useState("");
  const [source, setSource] = useState("");
  const [alwaysInclude, setAlwaysInclude] = useState(false);
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
        {kind === "preference" && (
          <label>
            {copy.preferenceRecall}
            <Select
              value={alwaysInclude ? "persistent" : "conditional"}
              onValueChange={(value) => setAlwaysInclude(value === "persistent")}
              options={[
                { value: "conditional", label: copy.conditionalPreference },
                { value: "persistent", label: `${copy.persistentPreference} · ${copy.persistentPreferenceHint}` },
              ]}
              ariaLabel={copy.preferenceRecall}
              className="composer-select"
            />
          </label>
        )}
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
              onClick={() => onCreate({ content, kind, project, source, alwaysInclude })}
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
  language,
}: {
  initial: AgentSettings;
  onSaved: (settings: AgentSettings) => Promise<void> | void;
  language: Language;
}) {
  const copy = ui[language];
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
      setModelMessage(copy.configSaveFailed);
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
      setModelMessage(nextModels.length ? copy.fetchedModels(nextModels.length) : copy.noModels);
    } catch {
      setModels([]);
      setModelMessage(copy.modelListFailed);
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
            <label className="config-field"><span>{copy.requestFormat}</span><Select value={provider} onValueChange={(value) => { setProvider(value); setModels([]); setModelMessage(""); }} options={[{ value: "openai", label: "OpenAI" }, { value: "anthropic", label: "Anthropic" }, { value: "openai-compatible", label: "OpenAI Compatible" }]} ariaLabel={copy.requestFormat} placeholder={copy.chooseRequestFormat} required disabled={saving} /></label>
            <label className="config-field"><span>{copy.model}</span><div className="model-field">{models.length ? <Select value={model} onValueChange={setModel} options={[...(model && !models.includes(model) ? [{ value: model, label: model }] : []), ...models.map((item) => ({ value: item, label: item }))]} ariaLabel={copy.model} placeholder={copy.chooseOrEnterModel} required disabled={saving} /> : <input required value={model} onChange={(event) => setModel(event.target.value)} placeholder={copy.chooseOrEnterModel} />}<button type="button" className="ghost-button" onClick={() => void fetchModels()} disabled={modelsBusy || saving}>{modelsBusy ? <LoaderCircle className="spin" size={14} /> : copy.fetchModels}</button></div>{modelMessage ? <small className="model-message">{modelMessage}</small> : null}</label>
          </div>
        </section>
      </div>
      <div className="agent-config-actions"><button className="primary-button" type="submit" disabled={saving}>{saving ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />}{saving ? copy.saving : saved ? copy.saved : copy.saveConfiguration}</button></div>
    </form>
  );
}

function AgentChat({ onMemoryChanged, language = "zh" }: { onMemoryChanged: () => void; language?: Language }) {
  const copy = ui[language];
  const welcomeMessage: AgentMessage = {
    id: "welcome",
    role: "assistant",
    content: copy.welcome,
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
      setError(detail === "missing_base_url" ? copy.missingBaseUrl : detail === "missing_api_key" ? copy.missingApiKey : detail.startsWith("provider_http_") ? copy.providerRequestFailed : copy.agentRequestFailed);
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
      setError(detail === "missing_base_url" ? copy.missingBaseUrl : detail === "missing_api_key" ? copy.missingApiKey : detail.startsWith("provider_http_") ? copy.providerRequestFailed : copy.agentRequestFailed);
    } finally { setActiveRequests((count) => Math.max(0, count - 1)); }
    */
  };
  const suggestions = [copy.suggestionTraits, copy.suggestionProjects, copy.suggestionConcise, "/new"];
  const openAgent = () => { setTab(isAgentConfigured(settings) ? "chat" : "config"); setOpen(true); };
  const streamingMessage = streamingId ? messages.find((message) => message.id === streamingId) : null;
  return (
    <div className={`agent-float ${open ? "agent-float-open" : ""}`}>
      <div className="agent-float-position">
        {!open && <button className="agent-float-button" onClick={openAgent} title={copy.openAgent} aria-label={copy.openAgent} disabled={!settingsLoaded}><Bot size={21} /></button>}
        {open && <section ref={panelRef} className="agent-panel" aria-label={settings.name}>
          <header className="agent-header">
            <div className="agent-title"><span className="agent-avatar"><Brain size={17} /></span><div><strong>{settings.name}</strong><span>{copy.agentDescription}</span></div></div>
            <button className="icon-button" onClick={() => setOpen(false)} title={copy.collapse} aria-label={copy.collapse}><ChevronDown size={18} /></button>
          </header>
          <div className="agent-tabs" role="tablist" aria-label={copy.agentTabs}>
            <button role="tab" aria-selected={tab === "chat"} className={tab === "chat" ? "active" : ""} disabled={!configured} onClick={() => setTab("chat")}><MessageCircle size={14} />{copy.chat}</button>
            <button role="tab" aria-selected={tab === "config"} className={tab === "config" ? "active" : ""} onClick={() => setTab("config")}><Settings2 size={14} />{copy.configuration}</button>
          </div>
          {tab === "config" ? <AgentConfigForm language={language} initial={settings} onSaved={(next) => { setSettings(next); setTab(isAgentConfigured(next) ? "chat" : "config"); }} /> : <>
            <div className="agent-messages">
              {messages.map((message) => <article className={`agent-message ${message.role}`} key={message.id}>
                {message.role === "user" || message.content ? <div className="agent-message-bubble">{message.role === "assistant" ? <Streamdown mode={streamingId === message.id ? "streaming" : "static"} isAnimating={streamingId === message.id} parseIncompleteMarkdown={streamingId === message.id} skipHtml>{message.content}</Streamdown> : <span className="agent-plain-text">{message.content}</span>}</div> : null}
                {message.toolCalls?.length ? <div className="agent-tool-calls">{message.toolCalls.filter((tool) => tool.name !== "memory_get_context" || (tool.count ?? 0) > 0).map((tool, index) => <span key={`${message.id}-tool-${index}`}><Check size={11} />{tool.label}{tool.count !== undefined ? ` · ${tool.count}` : ""}</span>)}</div> : null}
              </article>)}
              {sending && !streamingMessage?.content && <div className="agent-thinking" role="status" aria-label={copy.processing}><LoaderCircle size={14} /><span className="agent-thinking-label">{copy.readingMemory}</span><i /><i /><i /></div>}
              {error && <p className="agent-error" role="alert">{error}</p>}
            </div>
            <div className="agent-suggestions">{suggestions.map((suggestion) => <button key={suggestion} onClick={() => void send(suggestion)}>{suggestion}</button>)}</div>
            <form className="agent-composer" onSubmit={(event) => { event.preventDefault(); void send(); }}><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder={copy.agentPlaceholder} rows={1} /><button className="agent-send" type="submit" disabled={!draft.trim()} title={copy.send}><Send size={17} /></button></form>
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
