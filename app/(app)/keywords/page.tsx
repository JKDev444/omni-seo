import { getKeywordsPageData } from "@/lib/data/keywordsPageData";
import { FilterableTable } from "@/components/FilterableTable";
import { KeywordIdeaActions } from "@/components/KeywordIdeaActions";

const RECOMMENDATION_STYLE: Record<string, { background: string; color: string }> = {
  PURSUE: { background: "var(--color-success-soft)", color: "var(--color-success)" },
  CONSIDER: { background: "var(--color-warning-soft)", color: "var(--color-warning)" },
  SKIP: { background: "var(--color-surface-sunken)", color: "var(--color-ink-faint)" },
};

export const dynamic = "force-dynamic";

function pathFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname === "/" ? "/" : u.pathname;
  } catch {
    return url;
  }
}

function trendArrow(latest: number | null, previous: number | null): string {
  if (latest === null || previous === null) return "";
  if (latest < previous) return "▲";
  if (latest > previous) return "▼";
  return "—";
}

function trendClass(latest: number | null, previous: number | null): string {
  if (latest === null || previous === null) return "";
  if (latest < previous) return "status-completed";
  if (latest > previous) return "status-pending";
  return "";
}

export default async function KeywordsPage() {
  const data = await getKeywordsPageData();

  if (!data.site) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Keywords</h1>
            <p className="page-subtitle">No site configured yet</p>
          </div>
        </div>
      </div>
    );
  }

  if (data.keywords.length === 0 && data.ideas.length === 0) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Keywords</h1>
            <p className="page-subtitle">No keywords tracked yet</p>
          </div>
        </div>
        <div className="card">
          <h2 className="card-title">Rank tracking, cannibalization, content decay, CTR opportunities</h2>
          <p className="empty-state" style={{ marginBottom: "var(--space-4)" }}>
            Tracks live SERP position via DataForSEO for chosen keywords, plus free analysis derived from cached
            Search Console data: cannibalization (multiple owned pages competing for the same query), content decay
            (pages losing visibility over the last 28 days), and CTR opportunities (pages underperforming their
            position — title/meta rewrite candidates).
          </p>
          <ol style={{ paddingLeft: "var(--space-5)", fontSize: "var(--text-sm)", color: "var(--color-ink-muted)", lineHeight: 1.8 }}>
            <li>Discover keyword ideas worth going after: <code>npx tsx scripts/runKeywordDiscovery.ts</code></li>
            <li>Or see suggestions from existing traffic: <code>npx tsx scripts/seedKeywords.ts suggest</code></li>
            <li>Add keywords manually: <code>npx tsx scripts/seedKeywords.ts accept omnicenters.com &quot;phrase 1&quot; &quot;phrase 2&quot;</code></li>
            <li>Run rank checks: <code>npx tsx scripts/runKeywordRankings.ts</code></li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Keywords</h1>
          <p className="page-subtitle">Rank tracking, cannibalization, content decay, CTR opportunities</p>
        </div>
        <div className="page-meta">{data.keywords.length} tracked</div>
      </div>

      {data.ideas.length > 0 && (
        <div className="section card">
          <h2 className="card-title">Keyword opportunities</h2>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-ink-muted)", marginBottom: "var(--space-3)" }}>
            Real keyword ideas the site doesn&apos;t track yet, from DataForSEO Labs, seeded from your actual service
            pages. Volume is national (DataForSEO&apos;s keyword database isn&apos;t granular below the country
            level) — <strong>Pursue</strong>/<strong>Consider</strong>/<strong>Skip</strong> already accounts for
            that, weighing down generic national head terms in favor of realistic, locally-relevant, or low-competition
            opportunities. Read the reasoning before tracking one.
          </p>
          {data.ideas.map((idea) => (
            <div
              key={idea.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "var(--space-4)",
                padding: "var(--space-3) 0",
                borderBottom: "1px solid var(--color-border)",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "4px" }}>
                  <span className="tier-badge" style={RECOMMENDATION_STYLE[idea.recommendation]}>
                    {idea.recommendation}
                  </span>
                  <strong>{idea.phrase}</strong>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--color-ink-faint)" }}>
                    {idea.searchVolume ?? "—"}/mo · {idea.difficulty !== null ? `difficulty ${idea.difficulty}` : idea.competitionLevel ?? "unknown"}
                    {idea.intent ? ` · ${idea.intent}` : ""}
                  </span>
                </div>
                <p style={{ fontSize: "var(--text-sm)", color: "var(--color-ink-muted)", margin: 0 }}>{idea.rationale}</p>
              </div>
              <KeywordIdeaActions ideaId={idea.id} />
            </div>
          ))}
        </div>
      )}

      {data.keywords.length > 0 && (
        <div className="section card">
          <h2 className="card-title">Tracked keywords</h2>
          <FilterableTable
            headers={["Keyword", "Target page", "Volume", "Position", "Trend", "Local pack", "AI Overview", "Last checked"]}
            searchPlaceholder="Search keywords…"
            rows={data.keywords.map((k) => {
              const targetPath = k.targetUrl ? pathFromUrl(k.targetUrl) : "";
              return {
                key: k.id,
                searchText: `${k.phrase} ${targetPath}`,
                numericCols: [2, 3, 4],
                cells: [
                  k.phrase,
                  targetPath || "—",
                  k.searchVolume ?? "—",
                  k.latestPosition ?? "not found",
                  <span key="trend" className={trendClass(k.latestPosition, k.previousPosition)}>
                    {trendArrow(k.latestPosition, k.previousPosition)}
                  </span>,
                  k.localPack ? "Yes" : "—",
                  k.aiOverview ? "Yes" : "—",
                  k.lastCheckedAt ? new Date(k.lastCheckedAt).toLocaleDateString() : "never",
                ],
              };
            })}
          />
        </div>
      )}

      {data.cannibalization.length > 0 && (
        <div className="section card">
          <h2 className="card-title">Cannibalization — same query, multiple owned pages</h2>
          {data.cannibalization.map((issue) => (
            <div key={issue.query} style={{ marginBottom: "var(--space-4)" }}>
              <strong>&quot;{issue.query}&quot;</strong>
              <table className="table">
                <thead>
                  <tr>
                    <th>Page</th>
                    <th>Impressions</th>
                    <th>Clicks</th>
                    <th>Avg position</th>
                  </tr>
                </thead>
                <tbody>
                  {issue.pages.map((p) => (
                    <tr key={p.url}>
                      <td>{pathFromUrl(p.url)}</td>
                      <td className="num">{p.impressions}</td>
                      <td className="num">{p.clicks}</td>
                      <td className="num">{p.avgPosition}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {data.decay.length > 0 && (
        <div className="section card">
          <h2 className="card-title">Content decay — losing visibility (last 28 days vs. prior 28)</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Page</th>
                <th>Recent impressions</th>
                <th>Prior impressions</th>
                <th>Change</th>
                <th>Recent position</th>
                <th>Prior position</th>
              </tr>
            </thead>
            <tbody>
              {data.decay.map((d) => (
                <tr key={d.page}>
                  <td>{pathFromUrl(d.page)}</td>
                  <td className="num">{d.recentImpressions}</td>
                  <td className="num">{d.priorImpressions}</td>
                  <td className="num">{d.impressionsChangePct}%</td>
                  <td className="num">{d.recentPosition || "—"}</td>
                  <td className="num">{d.priorPosition}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.ctrRewrites.length > 0 && (
        <div className="section card">
          <h2 className="card-title">Suggested title/meta rewrites</h2>
          {data.ctrRewrites.map((r) => (
            <div key={r.url} style={{ marginBottom: "var(--space-5)", paddingBottom: "var(--space-4)", borderBottom: "1px solid var(--color-border)" }}>
              <strong>{pathFromUrl(r.url)}</strong>{" "}
              <span style={{ color: "var(--color-ink-muted)", fontSize: "var(--text-sm)" }}>
                — &quot;{r.query}&quot;, {r.impressions} impressions, {r.ctr}% CTR at position {r.avgPosition}
              </span>
              <table className="table" style={{ marginTop: "var(--space-2)" }}>
                <thead>
                  <tr>
                    <th></th>
                    <th>Title</th>
                    <th>Meta description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Current</td>
                    <td>{r.currentTitle ?? "(none)"}</td>
                    <td>{r.currentMetaDesc ?? "(none)"}</td>
                  </tr>
                  <tr>
                    <td>Suggested</td>
                    <td>{r.suggestedTitle}</td>
                    <td>{r.suggestedMetaDesc}</td>
                  </tr>
                </tbody>
              </table>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--color-ink-muted)", marginTop: "var(--space-2)" }}>{r.rationale}</p>
            </div>
          ))}
        </div>
      )}

      {data.ctrOpportunities.length > 0 && (
        <div className="section card">
          <h2 className="card-title">CTR opportunities — underperforming their position</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Page</th>
                <th>Top query</th>
                <th>Impressions</th>
                <th>CTR</th>
                <th>Expected CTR</th>
                <th>Avg position</th>
              </tr>
            </thead>
            <tbody>
              {data.ctrOpportunities.map((c) => (
                <tr key={c.page}>
                  <td>{pathFromUrl(c.page)}</td>
                  <td>{c.query ?? "—"}</td>
                  <td className="num">{c.impressions}</td>
                  <td className="num">{c.ctr}%</td>
                  <td className="num">{c.expectedCtr}%</td>
                  <td className="num">{c.avgPosition}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
