import type { Language } from "../types.js";

export type View =
  | "all"
  | "timeline"
  | "preferences"
  | "projects"
  | "tags"
  | "settings"
  | "mcp";

export const viewCopy: Record<Language, Record<View, { title: string; description: string }>> = {
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

export const viewRoutes = {
  all: "/",
  timeline: "/timeline",
  projects: "/scopes",
  preferences: "/preferences",
  tags: "/tags",
  settings: "/settings",
  mcp: "/mcp-service",
} as const satisfies Record<View, string>;

export const viewByPath = Object.fromEntries(
  Object.entries(viewRoutes).map(([view, path]) => [path, view]),
) as Record<string, View>;
