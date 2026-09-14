import React, { useEffect, useMemo, useState } from "react";
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
  ArrowUpRight,
  BookOpen,
  Brain,
  ChevronDown,
  Clock3,
  Command,
  Database,
  FileText,
  Filter,
  Layers3,
  Menu,
  Moon,
  Search,
  Server,
  Settings2,
  Sparkles,
  Sun,
  Tag,
  X,
} from "lucide-react";
import { Select } from "./components/ui/select.js";
import AgentChat from "./components/agent-chat.js";
import { LanguageSetup, SettingsPage } from "./components/settings.js";
import { MemoryCard, MemoryDetail } from "./components/memory.js";
import McpPage from "./pages/mcp-page.js";
import { Stat } from "./components/stat.js";
import { ui } from "./lib/copy.js";
import { kindLabels } from "./lib/kinds.js";
import { viewByPath, viewCopy, viewRoutes, type View } from "./lib/views.js";
import { type Language, type Memory } from "./types.js";
import "./styles.css";

declare const __MEMORY_ONE_VERSION__: string;

type VersionNotice = { current: string; latest: string };
const kinds = ["all", "fact", "preference", "episode", "procedure", "message"];

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
  const [mobileNav, setMobileNav] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [versionNotice, setVersionNotice] = useState<VersionNotice | null>(null);
  const [currentVersion, setCurrentVersion] = useState(__MEMORY_ONE_VERSION__);
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
        <AgentChat language={language} onMemoryChanged={() => void load()} />
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
                      <span title={`${item.project ?? item.scope} · ${item.source ?? ui[language].agentWritten}`}>
                        {item.project ?? item.scope} · {item.source ?? ui[language].agentWritten}
                      </span>
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

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
