import { useState } from "react";
import { Check, Database, LoaderCircle, Moon, Sun } from "lucide-react";
import { viewCopy } from "../lib/views.js";
import { downloadBackup, exportBackup as exportBackupRequest, importBackup as importBackupRequest } from "../api/client.js";
import { ui } from "../lib/copy.js";
import type { Language } from "../types.js";

export function LanguageSetup({ language, onSelect }: { language: Language; onSelect: (language: Language) => Promise<void> }) {
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

export function SettingsPage({
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
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMessage, setBackupMessage] = useState("");
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
  const exportBackup = async () => {
    setBackupBusy(true); setBackupMessage("");
    try {
      downloadBackup(await exportBackupRequest());
    } catch {
      setBackupMessage(copy.backupFailed);
    } finally { setBackupBusy(false); }
  };
  const importBackup = async (file: File, mode: "merge" | "replace") => {
    if (mode === "replace" && !window.confirm(copy.replaceConfirm)) return;
    setBackupBusy(true); setBackupMessage("");
    try {
      const data = JSON.parse(await file.text());
      const result = await importBackupRequest(data, mode);
      setBackupMessage(copy.backupImported(result.imported ?? 0, result.skipped ?? 0));
    } catch {
      setBackupMessage(copy.backupFailed);
    } finally { setBackupBusy(false); }
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
          <div><span className="eyebrow">{copy.backupEyebrow}</span><h2>{copy.backupTitle}</h2></div>
          <Database size={19} />
        </div>
        <div className="settings-row">
          <span><strong>{copy.backupTitle}</strong><small>{copy.backupDescription}</small></span>
          <div className="language-switch">
            <button onClick={() => void exportBackup()} disabled={backupBusy}>{copy.exportBackup}</button>
            <label className="settings-file-button">
              {copy.importMerge}
              <input type="file" accept="application/json,.json" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void importBackup(file, "merge"); event.target.value = ""; }} />
            </label>
            <label className="settings-file-button">
              {copy.importReplace}
              <input type="file" accept="application/json,.json" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void importBackup(file, "replace"); event.target.value = ""; }} />
            </label>
          </div>
        </div>
        {backupMessage ? <p className="settings-message" role="status">{backupMessage}</p> : null}
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
