import { getIndexationData } from "@/lib/data/indexation";

export const dynamic = "force-dynamic";

const STATUS_ORDER = [
  "Indexed",
  "Not Indexed",
  "Blocked",
  "Canonical Mismatch",
  "Discovered - Not Indexed",
  "Crawled - Not Indexed",
];

function fmtDateTime(d: Date | null): string {
  if (!d) return "never";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(d);
}

function pathFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname === "/" ? "/" : u.pathname;
  } catch {
    return url;
  }
}

export default async function IndexationPage() {
  const data = await getIndexationData();

  if (!data.site) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Indexation</h1>
            <p className="page-subtitle">No site configured yet</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data.connected || data.rows.length === 0) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Indexation</h1>
            <p className="page-subtitle">{data.connected ? "Not run yet" : "Not connected yet"}</p>
          </div>
        </div>
        <div className="card">
          <h2 className="card-title">Indexation Control Center</h2>
          <p className="empty-state">
            {data.connected
              ? "Search Console is connected, but the URL Inspection check hasn't run yet. Run npx tsx scripts/runIndexationCheck.ts to pull Google's actual index status for every crawled page."
              : "Uses the same service account as the Analytics page (Search Console access). Once gscSiteUrl is set and the service account has access, run npx tsx scripts/runIndexationCheck.ts to see what Google actually says about each page's index status — correlated against what our own crawler concluded."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Indexation</h1>
          <p className="page-subtitle">What Google says vs. what our crawler concluded</p>
        </div>
        <div className="page-meta">Last checked: {fmtDateTime(data.lastRunAt)}</div>
      </div>

      <div className="section rings-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
        {STATUS_ORDER.filter((s) => data.counts[s]).map((status) => (
          <div className="card" key={status}>
            <div className="ring-count">{status}</div>
            <div className="score data-value" style={{ fontSize: "var(--text-2xl)" }}>{data.counts[status]}</div>
          </div>
        ))}
      </div>

      {data.mismatches.length > 0 && (
        <div className="section card">
          <h2 className="card-title">Mismatches — we expected indexable, Google disagrees</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Page</th>
                <th>Our status code</th>
                <th>Google's status</th>
              </tr>
            </thead>
            <tbody>
              {data.mismatches.map((r) => (
                <tr key={r.url}>
                  <td>{pathFromUrl(r.url)}</td>
                  <td className="num">{r.ourStatusCode ?? "—"}</td>
                  <td>
                    <span className={r.googleStatus === "Blocked" || r.googleStatus === "Canonical Mismatch" ? "tier-badge tier-high" : "tier-badge tier-medium"}>
                      {r.googleStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="section card">
        <h2 className="card-title">All inspected pages</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Page</th>
              <th>Google's status</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.url}>
                <td>{pathFromUrl(r.url)}</td>
                <td>{r.googleStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
