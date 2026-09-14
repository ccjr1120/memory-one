import type { Language } from "../types.js";

export const formatDate = (value: string | null | undefined, language: Language) =>
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
