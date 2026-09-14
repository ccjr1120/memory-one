export function Stat({
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
