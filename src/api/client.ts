import type { DataImportResult } from "../types.js";

export async function exportBackup(): Promise<Blob> {
  const response = await fetch("/api/data/export");
  if (!response.ok) throw new Error("export_failed");
  return response.blob();
}

export async function importBackup(data: unknown, mode: "merge" | "replace"): Promise<DataImportResult> {
  const response = await fetch("/api/data/import", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ data, mode }),
  });
  const result = await response.json() as DataImportResult;
  if (!response.ok) throw new Error("import_failed");
  return result;
}

export function downloadBackup(blob: Blob, date = new Date()) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `memory-one-backup-${date.toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
