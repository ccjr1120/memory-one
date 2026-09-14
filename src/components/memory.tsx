import { useEffect, useState } from "react";
import { Database, Layers3, Tag } from "lucide-react";
import { Streamdown } from "streamdown";
import { ui } from "../lib/copy.js";
import { formatDate } from "../lib/format.js";
import { kindLabels } from "../lib/kinds.js";
import type { Language, Memory, RecallEvent } from "../types.js";

export function MemoryCard({
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
      <Streamdown
        className="memory-markdown memory-card-content"
        controls={false}
        mode="static"
        skipHtml
      >
        {item.content}
      </Streamdown>
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
export function MemoryDetail({
  item,
  language,
}: {
  item: Memory;
  language: Language;
}) {
  const copy = ui[language];
  const labels = kindLabels[language];
  const [recalls, setRecalls] = useState<RecallEvent[]>([]);
  useEffect(() => {
    let active = true;
    setRecalls([]);
    fetch(`/api/memories/${item.id}/recalls?limit=5`)
      .then((response) => response.json() as Promise<RecallEvent[]>)
      .then((value) => { if (active) setRecalls(Array.isArray(value) ? value : []); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [item.id]);
  return (
    <div className="detail-body">
      <div className={`detail-kind kind-badge kind-${item.kind}`}>
        {labels[item.kind] ?? item.kind}
      </div>
      {item.kind === "preference" && item.metadata.always_include === true && (
        <div className="detail-kind kind-badge">{copy.persistentPreference}</div>
      )}
      <Streamdown
        className="memory-markdown memory-detail-content"
        controls={false}
        mode="static"
        skipHtml
      >
        {item.content}
      </Streamdown>
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
        <div className="scope-value" title={item.project ? `${item.scope} / ${item.project}` : item.scope}>
          <Database size={15} />
          <span className="scope-value-text">
            {item.project ? `${item.scope} / ${item.project}` : item.scope}
          </span>
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
      {recalls.length ? (
        <div className="detail-section">
          <span className="eyebrow">{copy.recentRecalls}</span>
          <div className="recall-events">
            {recalls.map((recall) => (
              <div key={recall.id} className="recall-event">
                <strong>{recall.source}</strong>
                <span>{recall.query || "—"}</span>
                <small>{formatDate(recall.created_at, language)}</small>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
export function Signal({
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
