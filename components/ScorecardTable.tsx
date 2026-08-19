interface ScorecardRow {
  metric: string;
  baseline: number | null;
  current: number | null;
  target: number | null;
  source: string | null;
}

function fmt(v: number | null): string {
  return v === null || v === undefined ? "—" : Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function trendClass(baseline: number | null, current: number | null): string {
  if (baseline === null || current === null) return "";
  if (current > baseline) return "trend-up";
  if (current < baseline) return "trend-down";
  return "";
}

export function ScorecardTable({ rows }: { rows: ScorecardRow[] }) {
  return (
    <div className="card" id="scorecard">
      <h2 className="card-title">Scorecard</h2>
      {rows.length === 0 ? (
        <p className="empty-state">No scorecard metrics recorded yet.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>Baseline</th>
              <th>Current</th>
              <th>Target</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.metric}>
                <td>{row.metric}</td>
                <td className="num">{fmt(row.baseline)}</td>
                <td className={`num ${trendClass(row.baseline, row.current)}`}>{fmt(row.current)}</td>
                <td className="num">{fmt(row.target)}</td>
                <td>{row.source ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
