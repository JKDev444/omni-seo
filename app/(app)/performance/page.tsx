import { getCoreWebVitalsData } from "@/lib/data/coreWebVitals";

export const dynamic = "force-dynamic";

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

function ratingClass(rating: string | null): string {
  if (rating === "good") return "status-completed";
  if (rating === "needs-improvement") return "status-pending";
  if (rating === "poor") return "";
  return "";
}

export default async function PerformancePage() {
  const data = await getCoreWebVitalsData();

  if (!data.site) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Performance</h1>
            <p className="page-subtitle">No site configured yet</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data.connected) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Performance</h1>
            <p className="page-subtitle">Not connected yet</p>
          </div>
        </div>
        <div className="card">
          <h2 className="card-title">Core Web Vitals</h2>
          <p className="empty-state" style={{ marginBottom: "var(--space-4)" }}>
            Real-user field data from the Chrome UX Report, plus Lighthouse lab diagnostics on the homepage. Simpler
            setup than Analytics/Indexation — just an API key, no service account.
          </p>
          <ol style={{ paddingLeft: "var(--space-5)", fontSize: "var(--text-sm)", color: "var(--color-ink-muted)", lineHeight: 1.8 }}>
            <li>Google Cloud Console → enable <strong>Chrome UX Report API</strong> and <strong>PageSpeed Insights API</strong></li>
            <li>Create (or reuse) an API key, set it as <code>GOOGLE_PAGESPEED_API_KEY</code></li>
            <li>Run <code>npx tsx scripts/runCoreWebVitalsCheck.ts</code></li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Performance</h1>
          <p className="page-subtitle">Core Web Vitals — real-user field data (CrUX)</p>
        </div>
        <div className="page-meta">Last checked: {fmtDateTime(data.lastFetched)}</div>
      </div>

      <div className="section rings-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
        <div className="card">
          <div className="ring-count status-completed">Good</div>
          <div className="score data-value" style={{ fontSize: "var(--text-2xl)" }}>{data.summary.good}</div>
        </div>
        <div className="card">
          <div className="ring-count status-pending">Needs improvement</div>
          <div className="score data-value" style={{ fontSize: "var(--text-2xl)" }}>{data.summary.needsImprovement}</div>
        </div>
        <div className="card">
          <div className="ring-count" style={{ color: "var(--color-critical)" }}>Poor</div>
          <div className="score data-value" style={{ fontSize: "var(--text-2xl)" }}>{data.summary.poor}</div>
        </div>
        {data.homepagePsi?.performanceScore != null && (
          <div className="card">
            <div className="ring-count">Homepage Lighthouse score</div>
            <div className="score data-value" style={{ fontSize: "var(--text-2xl)" }}>{data.homepagePsi.performanceScore}</div>
          </div>
        )}
      </div>

      <div className="section card">
        <h2 className="card-title">Field data by page</h2>
        {data.fieldRows.length === 0 ? (
          <p className="empty-state">No CrUX data yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Page</th>
                <th>Device</th>
                <th>LCP</th>
                <th>INP</th>
                <th>CLS</th>
              </tr>
            </thead>
            <tbody>
              {data.fieldRows.map((r) => (
                <tr key={`${r.url}-${r.formFactor}`}>
                  <td>
                    {pathFromUrl(r.url)}
                    {r.isOriginFallback && <span className="page-meta" style={{ marginLeft: "var(--space-2)" }}>(origin-level)</span>}
                  </td>
                  <td>{r.formFactor === "PHONE" ? "Mobile" : "Desktop"}</td>
                  <td className={`num ${ratingClass(r.lcpRating)}`}>{r.lcpMs != null ? `${(r.lcpMs / 1000).toFixed(1)}s` : "—"}</td>
                  <td className={`num ${ratingClass(r.inpRating)}`}>{r.inpMs != null ? `${Math.round(r.inpMs)}ms` : "—"}</td>
                  <td className={`num ${ratingClass(r.clsRating)}`}>{r.cls != null ? r.cls.toFixed(2) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data.homepagePsi && data.homepagePsi.opportunities.length > 0 && (
        <div className="section card">
          <h2 className="card-title">Homepage — top Lighthouse opportunities</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Opportunity</th>
                <th>Est. savings</th>
              </tr>
            </thead>
            <tbody>
              {data.homepagePsi.opportunities.map((o) => (
                <tr key={o.id}>
                  <td>{o.title}</td>
                  <td className="num">{o.savingsMs != null ? `${Math.round(o.savingsMs)}ms` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
