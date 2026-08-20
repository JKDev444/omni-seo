import { getAnalyticsData } from "@/lib/data/analytics";
import { AnalyticsTrendChart } from "@/components/AnalyticsTrendChart";

export const dynamic = "force-dynamic";

function fmtNum(n: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function fmtDateTime(d: Date | null): string {
  if (!d) return "never";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(d);
}

export default async function AnalyticsPage() {
  const data = await getAnalyticsData();

  if (!data.site) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Analytics</h1>
            <p className="page-subtitle">No site configured yet</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data.gscConnected && !data.ga4Connected) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Analytics</h1>
            <p className="page-subtitle">Not connected yet</p>
          </div>
        </div>
        <div className="card">
          <h2 className="card-title">Connect Google Search Console + GA4</h2>
          <p className="empty-state" style={{ marginBottom: "var(--space-4)" }}>
            This page pulls real traffic and search performance data once connected. Setup is a service account —
            no OAuth login flow, no dependency on who&apos;s signed into this dashboard.
          </p>
          <ol style={{ paddingLeft: "var(--space-5)", fontSize: "var(--text-sm)", color: "var(--color-ink-muted)", lineHeight: 1.8 }}>
            <li>Google Cloud Console → create a service account, enable <strong>Search Console API</strong> and <strong>Google Analytics Data API</strong></li>
            <li>Download the service account&apos;s JSON key, set it as <code>GOOGLE_SERVICE_ACCOUNT_KEY</code> (raw JSON or base64)</li>
            <li>Search Console → Settings → Users and permissions → add the service account&apos;s email as a user</li>
            <li>GA4 → Admin → Property Access Management → add the service account&apos;s email</li>
            <li>Set <code>gscSiteUrl</code> and <code>ga4PropertyId</code> on the Site record</li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Search Console + GA4 — last 90 days</p>
        </div>
        <div className="page-meta">
          GSC last synced: {fmtDateTime(data.gscLastFetched)}
          <br />
          GA4 last synced: {fmtDateTime(data.ga4LastFetched)}
        </div>
      </div>

      <div className="section rings-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
        <div className="card">
          <div className="ring-count">Sessions</div>
          <div className="score data-value" style={{ fontSize: "var(--text-2xl)" }}>{fmtNum(data.totals.sessions)}</div>
        </div>
        <div className="card">
          <div className="ring-count">Users</div>
          <div className="score data-value" style={{ fontSize: "var(--text-2xl)" }}>{fmtNum(data.totals.users)}</div>
        </div>
        <div className="card">
          <div className="ring-count">Conversions</div>
          <div className="score data-value" style={{ fontSize: "var(--text-2xl)" }}>{fmtNum(data.totals.conversions)}</div>
        </div>
        <div className="card">
          <div className="ring-count">Clicks (GSC)</div>
          <div className="score data-value" style={{ fontSize: "var(--text-2xl)" }}>{fmtNum(data.totals.clicks)}</div>
        </div>
        <div className="card">
          <div className="ring-count">Impressions</div>
          <div className="score data-value" style={{ fontSize: "var(--text-2xl)" }}>{fmtNum(data.totals.impressions)}</div>
        </div>
        <div className="card">
          <div className="ring-count">Avg. CTR</div>
          <div className="score data-value" style={{ fontSize: "var(--text-2xl)" }}>{fmtPct(data.totals.ctr)}</div>
        </div>
        <div className="card">
          <div className="ring-count">Avg. Position</div>
          <div className="score data-value" style={{ fontSize: "var(--text-2xl)" }}>{data.totals.avgPosition.toFixed(1)}</div>
        </div>
      </div>

      {data.trend.length > 0 && (
        <div className="section card">
          <h2 className="card-title">Traffic over time</h2>
          <AnalyticsTrendChart trend={data.trend} />
        </div>
      )}

      <div className="section two-col">
        <div className="card">
          <h2 className="card-title">Top queries</h2>
          {data.topQueries.length === 0 ? (
            <p className="empty-state">No query data yet.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Query</th>
                  <th>Clicks</th>
                  <th>Impressions</th>
                  <th>CTR</th>
                  <th>Position</th>
                </tr>
              </thead>
              <tbody>
                {data.topQueries.map((q) => (
                  <tr key={q.query}>
                    <td>{q.query}</td>
                    <td className="num">{fmtNum(q.clicks)}</td>
                    <td className="num">{fmtNum(q.impressions)}</td>
                    <td className="num">{fmtPct(q.ctr)}</td>
                    <td className="num">{q.position.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h2 className="card-title">Top pages</h2>
          {data.topPages.length === 0 ? (
            <p className="empty-state">No page data yet.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Page</th>
                  <th>Sessions</th>
                  <th>Clicks</th>
                </tr>
              </thead>
              <tbody>
                {data.topPages.map((p) => (
                  <tr key={p.page}>
                    <td>{p.page}</td>
                    <td className="num">{fmtNum(p.sessions)}</td>
                    <td className="num">{fmtNum(p.clicks)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {(data.channelBreakdown.length > 0 || data.deviceBreakdown.length > 0) && (
        <div className="section two-col">
          <div className="card">
            <h2 className="card-title">Channel breakdown</h2>
            <table className="table">
              <thead>
                <tr>
                  <th>Channel</th>
                  <th>Sessions</th>
                </tr>
              </thead>
              <tbody>
                {data.channelBreakdown.map((c) => (
                  <tr key={c.channel}>
                    <td>{c.channel}</td>
                    <td className="num">{fmtNum(c.sessions)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card">
            <h2 className="card-title">Device breakdown</h2>
            <table className="table">
              <thead>
                <tr>
                  <th>Device</th>
                  <th>Sessions</th>
                </tr>
              </thead>
              <tbody>
                {data.deviceBreakdown.map((d) => (
                  <tr key={d.device}>
                    <td>{d.device}</td>
                    <td className="num">{fmtNum(d.sessions)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
