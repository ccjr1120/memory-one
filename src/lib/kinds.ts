import type { Language } from "../types.js";

export const kindLabels: Record<Language, Record<string, string>> = {
  zh: { all: "全部", fact: "事实", preference: "偏好", episode: "事件", procedure: "方法", message: "对话" },
  en: { all: "All", fact: "Fact", preference: "Preference", episode: "Episode", procedure: "Procedure", message: "Message" },
};
