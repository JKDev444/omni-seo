interface CitationRow {
  id: string;
  directory: string;
  publicUrl: string | null;
  napConsistent: boolean | null;
  indexed: boolean | null;
  lastCheckedAt: Date | null;
}

function fmtDate(d: Date | null): string {
  if (!d) return "never";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d);
}

function dotClass(v: boolean | null): string {
  if (v === true) return "dot ok";
  if (v === false) return "dot bad";
  return "dot";
}

function dotLabel(v: boolean | null): string {
  if (v === true) return "Yes";
  if (v === false) return "No";
  return "Unchecked";
}

export function CitationTracker({ rows }: { rows: CitationRow[] }) {
  return (
    <div className="card" id="citations">
      <h2 className="card-title">Citation tracker</h2>
      {rows.length === 0 ? (
        <p className="empty-state">No citations tracked yet.</p>
      ) : (
        <div>
          <div className="citation-row" style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "var(--text-xs)", color: "var(--color-ink-faint)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
            <span>Directory</span>
            <span>NAP consistent</span>
            <span>Indexed</span>
            <span>Last checked</span>
          </div>
          {rows.map((c) => (
            <div className="citation-row" key={c.id}>
              <span className="citation-directory">
                {c.publicUrl ? (
                  <a href={c.publicUrl} target="_blank" rel="noopener noreferrer">
                    {c.directory}
                  </a>
                ) : (
                  c.directory
                )}
              </span>
              <span className={dotClass(c.napConsistent)}>{dotLabel(c.napConsistent)}</span>
              <span className={dotClass(c.indexed)}>{dotLabel(c.indexed)}</span>
              <span className="page-meta">{fmtDate(c.lastCheckedAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
