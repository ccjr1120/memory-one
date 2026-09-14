import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUp,
  Bot,
  Brain,
  Check,
  ChevronDown,
  Clock3,
  LoaderCircle,
  Settings2,
  X,
} from "lucide-react";
import { Streamdown } from "streamdown";
import { Select } from "./ui/select.js";
import { ui } from "../lib/copy.js";
import type { Language } from "../types.js";

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
type AgentMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: Array<{ name: string; label: string; count?: number }>;
  created_at?: string;
};

export function AgentConfigForm({
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
      await onSaved(next);
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
  useEffect(() => {
    if (!baseUrl.trim() && !apiKey.trim() && !model.trim() && !provider.trim()) return;
    const timer = window.setTimeout(() => { void save(); }, 500);
    return () => window.clearTimeout(timer);
  }, [baseUrl, apiKey, model, provider]);
  return (
    <form className="agent-config-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <div className="agent-config-scroll">
        <div className="agent-config-heading">
          <div>
            <span className="agent-config-kicker"><Settings2 size={13} />{copy.configuration}</span>
            <strong>{copy.agentName}</strong>
            <p>{copy.agentDescription}</p>
          </div>
          <span className="agent-config-status">{saving ? copy.saving : copy.saved}</span>
        </div>
        <section className="agent-config-section">
          <div className="agent-config-fields">
            <label className="config-field"><span>Base URL</span><input required value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://api.example.com/v1" /></label>
            <label className="config-field"><span>API Key</span><input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="sk-..." autoComplete="off" /></label>
            <label className="config-field"><span>{copy.requestFormat}</span><Select value={provider} onValueChange={(value) => { setProvider(value); setModels([]); setModelMessage(""); }} options={[{ value: "openai", label: "OpenAI" }, { value: "anthropic", label: "Anthropic" }, { value: "openai-compatible", label: "OpenAI Compatible" }]} ariaLabel={copy.requestFormat} placeholder={copy.chooseRequestFormat} required disabled={saving} /></label>
            <label className="config-field"><span>{copy.model}</span><div className="model-field">{models.length ? <Select value={model} onValueChange={setModel} options={[...(model && !models.includes(model) ? [{ value: model, label: model }] : []), ...models.map((item) => ({ value: item, label: item }))]} ariaLabel={copy.model} placeholder={copy.chooseOrEnterModel} required disabled={saving} /> : <input required value={model} onChange={(event) => setModel(event.target.value)} placeholder={copy.chooseOrEnterModel} />}<button type="button" className="ghost-button" onClick={() => void fetchModels()} disabled={modelsBusy || saving}>{modelsBusy ? <LoaderCircle className="spin" size={14} /> : copy.fetchModels}</button></div>{modelMessage ? <small className="model-message">{modelMessage}</small> : null}</label>
          </div>
        </section>
      </div>
    </form>
  );
}

export default function AgentChat({ onMemoryChanged, language = "zh" }: { onMemoryChanged: () => void; language?: Language }) {
  const copy = ui[language];
  const welcomeMessage: AgentMessage = { id: "welcome", role: "assistant", content: copy.welcome };
  const [settings, setSettings] = useState<AgentSettings>(defaultAgentSettings);
  const [tab, setTab] = useState<"chat" | "config">("config");
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [messages, setMessages] = useState<AgentMessage[]>([welcomeMessage]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [contextLoaded, setContextLoaded] = useState(false);
  const panelRef = useRef<HTMLElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const configured = isAgentConfigured(settings);

  useEffect(() => {
    let active = true;
    void fetch("/api/agent/config").then(async (response) => {
      if (!response.ok) throw new Error("config");
      return await response.json() as Partial<AgentSettings> & { base_url?: string; api_key?: string; auto_context?: boolean };
    }).then((value) => {
      if (!active) return;
      const next = toAgentSettings(value);
      setSettings(next);
      setTab(isAgentConfigured(next) ? "chat" : "config");
    }).catch(() => undefined).finally(() => { if (active) setSettingsLoaded(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    void fetch("/api/agent/messages").then((response) => response.ok ? response.json() : []).then((value: AgentMessage[]) => {
      if (Array.isArray(value) && value.length) setMessages(value);
    }).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (event.target instanceof Element && event.target.closest(".ui-select-content")) return;
      if (!panelRef.current?.contains(event.target)) { setOpen(false); setShowHistory(false); }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  useEffect(() => {
    setContextLoaded(false);
  }, [settings.scope, settings.provider, settings.model, settings.baseUrl, settings.apiKey, settings.autoContext]);
  useEffect(() => {
    if (!open || tab !== "chat") return;
    const frame = window.requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView({ block: "end" }));
    return () => window.cancelAnimationFrame(frame);
  }, [messages, busy, error, open, tab]);

  const persist = (message: AgentMessage) => fetch("/api/agent/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(message) }).catch(() => undefined);
  const send = async (value = draft) => {
    const content = value.trim();
    if (!content || busy || !configured) return;
    if (content.toLowerCase() === "/new") {
      setDraft(""); setError(""); setContextLoaded(false); setMessages([{ ...welcomeMessage, id: crypto.randomUUID() }]); return;
    }
    setDraft(""); setError(""); setBusy(true); setActiveTool(null);
    const user = { id: crypto.randomUUID(), role: "user" as const, content };
    const assistant = { id: crypto.randomUUID(), role: "assistant" as const, content: "", toolCalls: [] as AgentMessage["toolCalls"] };
    setStreamingId(assistant.id);
    setMessages((current) => [...current, user, assistant]);
    void persist(user); void persist(assistant);
    const controller = new AbortController(); abortRef.current = controller;
    const shouldLoadContext = settings.autoContext && !contextLoaded;
    try {
      const response = await fetch("/api/agent/stream", { method: "POST", signal: controller.signal, headers: { "content-type": "application/json" }, body: JSON.stringify({ message: content, user_message_id: user.id, assistant_message_id: assistant.id, provider: settings.provider, model: settings.model, base_url: settings.baseUrl || null, api_key: settings.apiKey || null, scope: settings.scope || null, auto_context: shouldLoadContext, history: [...messages, user].slice(-12).map(({ role, content: text }) => ({ role, content: text })) }) });
      if (!response.ok || !response.body) throw new Error("agent_request_failed");
      if (shouldLoadContext) setContextLoaded(true);
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ""; let text = ""; let tools: NonNullable<AgentMessage["toolCalls"]> = [];
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        const chunks = buffer.split(/\r?\n\r?\n/); buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const eventName = chunk.match(/^event:\s*(.+)$/m)?.[1]?.trim() ?? "message";
          const line = chunk.split(/\r?\n/).find((item) => item.startsWith("data:")); if (!line) continue;
          const data = JSON.parse(line.slice(5).trim()) as Record<string, unknown>;
          if (eventName === "delta") { text += String(data.text ?? ""); setActiveTool(null); setMessages((current) => current.map((item) => item.id === assistant.id ? { ...item, content: text } : item)); }
          if (eventName === "tool") { const tool = data as unknown as NonNullable<AgentMessage["toolCalls"]>[number]; tools = [...tools, tool]; setActiveTool(String(data.label ?? data.name ?? "tool")); setMessages((current) => current.map((item) => item.id === assistant.id ? { ...item, toolCalls: tools } : item)); }
          if (eventName === "error") throw new Error(String(data.detail ?? "agent_request_failed"));
          if (eventName === "done") tools = Array.isArray(data.toolCalls) ? data.toolCalls as NonNullable<AgentMessage["toolCalls"]> : tools;
        }
        if (done) break;
      }
      void persist({ ...assistant, content: text, toolCalls: tools });
      setMessages((current) => current.map((item) => item.id === assistant.id ? { ...item, content: text, toolCalls: tools } : item));
      if (tools.some((tool) => ["memory_store", "memory_update", "memory_delete"].includes(tool.name))) onMemoryChanged();
    } catch (caught) {
      if (!(caught instanceof DOMException && caught.name === "AbortError")) setError(caught instanceof Error && caught.message === "missing_api_key" ? copy.missingApiKey : copy.agentRequestFailed);
    } finally { setBusy(false); setActiveTool(null); setStreamingId(null); abortRef.current = null; }
  };
  const streamingMessage = streamingId ? messages.find((message) => message.id === streamingId) : null;
  const suggestions = [copy.suggestionTraits, copy.suggestionProjects, copy.suggestionConcise];
  const composer = <form className="agent-lite-composer" onSubmit={(event) => { event.preventDefault(); void send(); }}><textarea value={draft} onFocus={() => setOpen(true)} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder={copy.agentPlaceholder} rows={1} /><div className="agent-lite-actions"><button type="button" className="agent-lite-tool" onClick={() => setShowHistory((value) => !value)} title={copy.newMemory}><Clock3 size={15} /></button><button className="agent-lite-submit" type="submit" disabled={!draft.trim() || busy || !configured} title={busy ? copy.cancel : copy.send} onClick={busy ? (event) => { event.preventDefault(); abortRef.current?.abort(); } : undefined}>{busy ? <X size={16} /> : <ArrowUp size={16} />}</button></div></form>;
  const launcher = <button type="button" className={`agent-lite-launcher ${open ? "is-hidden" : ""}`} onClick={() => setOpen(true)} title={settings.name} aria-label={settings.name}><Bot size={22} /></button>;
  if (!settingsLoaded) return launcher;
  const isConfigTab = tab === "config";
  return <>{launcher}<div className={`agent-lite-root ${open ? "is-open" : ""} ${isConfigTab ? "is-config" : "is-chat"}`}>
    <section ref={panelRef} className="agent-lite-panel" aria-label={settings.name}>
      <div className="agent-lite-expanded" aria-hidden={!open}>
        <header className="agent-lite-header"><div className="agent-lite-brand"><span className="agent-avatar"><Brain size={16} /></span><div><strong>{settings.name}</strong><span>{isConfigTab ? copy.configuration : busy ? (activeTool || copy.processing) : copy.agentDescription}</span></div></div><div className="agent-lite-header-actions"><button type="button" className={`agent-lite-mode-button ${isConfigTab ? "is-back" : ""}`} onClick={() => { setTab(isConfigTab ? "chat" : "config"); setShowHistory(false); }} title={isConfigTab ? copy.backToChat : copy.configuration} aria-label={isConfigTab ? copy.backToChat : copy.configuration}>{isConfigTab ? <ArrowLeft size={15} /> : <Settings2 size={15} />}<span>{isConfigTab ? copy.backToChat : copy.configuration}</span></button><button type="button" className="icon-button" onClick={() => { setOpen(false); setShowHistory(false); }} title={copy.close} aria-label={copy.close}><ChevronDown size={16} /></button></div></header>
        <div className={`agent-lite-body ${isConfigTab ? "is-config" : "is-chat"}`}>{isConfigTab ? <AgentConfigForm language={language} initial={settings} onSaved={(next) => { setSettings(next); }} /> : <><div className="agent-lite-messages">{messages.map((message) => <article className={`agent-message ${message.role}`} key={message.id}>{message.content ? <div className="agent-message-bubble">{message.role === "assistant" ? <Streamdown className="agent-markdown" controls={false} mode={streamingId === message.id ? "streaming" : "static"} isAnimating={streamingId === message.id} parseIncompleteMarkdown={streamingId === message.id} skipHtml>{message.content}</Streamdown> : <span className="agent-plain-text">{message.content}</span>}</div> : null}{message.toolCalls?.some((tool) => tool.name !== "memory-get-context") ? <div className="agent-tool-calls">{message.toolCalls.filter((tool) => tool.name !== "memory-get-context").map((tool, index) => <span key={`${message.id}-${index}`}><Check size={11} />{tool.label}</span>)}</div> : null}</article>)}{busy && !streamingMessage?.content && <div className="agent-thinking"><LoaderCircle size={14} /><span className="agent-thinking-label">{activeTool || copy.readingMemory}</span><i /><i /><i /></div>}{error && <p className="agent-error">{error}</p>}<div ref={messagesEndRef} className="agent-messages-end" /></div><div className="agent-lite-suggestions">{suggestions.map((item) => <button key={item} onClick={() => void send(item)} disabled={busy}>{item}</button>)}</div></>}</div>
      </div>
      {!isConfigTab ? composer : null}
      {!isConfigTab && showHistory ? <div className="agent-lite-popover"><button type="button" onClick={() => { setMessages([{ ...welcomeMessage, id: crypto.randomUUID() }]); setDraft(""); setError(""); setShowHistory(false); }}>{copy.newMemory}</button><span>/new</span></div> : null}
    </section>
  </div></>;
}
