import { getContentAnalysisData } from "@/lib/data/contentAnalysisData";

export const dynamic = "force-dynamic";

function pathFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname === "/" ? "/" : u.pathname;
  } catch {
    return url;
  }
}

function scoreClass(score: number | null): string {
  if (score === null) return "";
  if (score >= 70) return "status-completed";
  if (score >= 40) return "status-pending";
  return "";
}

export default async function ContentPage() {
  const data = await getContentAnalysisData();

  if (!data.site) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Content Quality</h1>
            <p className="page-subtitle">No site configured yet</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data.hasData) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Content Quality</h1>
            <p className="page-subtitle">Not run yet</p>
          </div>
        </div>
        <div className="card">
          <h2 className="card-title">LLM-assisted content review</h2>
          <p className="empty-state" style={{ marginBottom: "var(--space-4)" }}>
            Scores each page against the audit methodology's content rubric: heading/intent match, intro quality,
            entity coverage, trust signals, freshness, CTA consistency. Uses a cheap Claude model — a real per-page
            cost, so this is a separate opt-in step, not part of every crawl.
          </p>
          <ol style={{ paddingLeft: "var(--space-5)", fontSize: "var(--text-sm)", color: "var(--color-ink-muted)", lineHeight: 1.8 }}>
            <li>Set <code>ANTHROPIC_API_KEY</code></li>
            <li>Run <code>npx tsx scripts/runContentAnalysis.ts</code></li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Content Quality</h1>
          <p className="page-subtitle">LLM-assisted review — heading/intent, intro, entities, trust, freshness, CTA</p>
        </div>
        <div className="page-meta">Site average: {data.avgScore ?? "—"}</div>
      </div>

      <div className="section card">
        <h2 className="card-title">All reviewed pages — sorted by overall score (lowest first)</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Page</th>
              <th>Heading/Intent</th>
              <th>Intro</th>
              <th>Entities</th>
              <th>Trust</th>
              <th>Freshness</th>
              <th>CTA</th>
              <th>Overall</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.url}>
                <td>{pathFromUrl(r.url)}</td>
                <td className={`num ${scoreClass(r.headingIntentScore)}`}>{r.headingIntentScore ?? "—"}</td>
                <td className={`num ${scoreClass(r.introQualityScore)}`}>{r.introQualityScore ?? "—"}</td>
                <td className={`num ${scoreClass(r.entityCoverageScore)}`}>{r.entityCoverageScore ?? "—"}</td>
                <td className={`num ${scoreClass(r.trustSignalsScore)}`}>{r.trustSignalsScore ?? "—"}</td>
                <td className={`num ${scoreClass(r.freshnessScore)}`}>{r.freshnessScore ?? "—"}</td>
                <td className={`num ${scoreClass(r.ctaConsistencyScore)}`}>{r.ctaConsistencyScore ?? "—"}</td>
                <td className={`num ${scoreClass(r.overallScore)}`}>{r.overallScore ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
