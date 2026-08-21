import { getAiSearchReadinessData } from "@/lib/data/aiSearchReadinessData";
import { FilterableTable } from "@/components/FilterableTable";

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

export default async function AiSearchPage() {
  const data = await getAiSearchReadinessData();

  if (!data.site) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">AI Search Readiness</h1>
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
            <h1 className="page-title">AI Search Readiness</h1>
            <p className="page-subtitle">Not run yet</p>
          </div>
        </div>
        <div className="card">
          <h2 className="card-title">How citeable is your content for AI Overviews and ChatGPT?</h2>
          <p className="empty-state" style={{ marginBottom: "var(--space-4)" }}>
            Scores each page on entity clarity (can an AI system tell what business/service/location this page is
            about?), citation readiness (concrete, attributable facts vs. vague marketing language), extractability
            (clean standalone passages vs. content only meaningful in context), and whether the page has a direct
            40-80 word answer block near the top. This is not a claim of measuring actual AI-citation rankings —
            that needs a paid tracking service — it scores the on-page signals that make citation more likely.
          </p>
          <ol style={{ paddingLeft: "var(--space-5)", fontSize: "var(--text-sm)", color: "var(--color-ink-muted)", lineHeight: 1.8 }}>
            <li>Set <code>ANTHROPIC_API_KEY</code></li>
            <li>Run <code>npx tsx scripts/runAiSearchReadiness.ts</code></li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">AI Search Readiness</h1>
          <p className="page-subtitle">Entity clarity, citation readiness, extractability — for AI Overviews &amp; ChatGPT</p>
        </div>
        <div className="page-meta">
          Site average: {data.avgScore ?? "—"} · Answer block coverage: {data.answerBlockCoverage ?? "—"}%
        </div>
      </div>

      <div className="section card">
        <h2 className="card-title">All reviewed pages — sorted by overall score (lowest first)</h2>
        <FilterableTable
          headers={["Page", "Entity Clarity", "Citation Readiness", "Extractability", "Answer Block", "Overall"]}
          searchPlaceholder="Search pages…"
          rows={data.rows.map((r) => ({
            key: r.url,
            searchText: pathFromUrl(r.url),
            numericCols: [1, 2, 3, 5],
            cells: [
              pathFromUrl(r.url),
              <span key="ec" className={scoreClass(r.entityClarityScore)}>{r.entityClarityScore ?? "—"}</span>,
              <span key="cr" className={scoreClass(r.citationReadinessScore)}>{r.citationReadinessScore ?? "—"}</span>,
              <span key="ex" className={scoreClass(r.extractabilityScore)}>{r.extractabilityScore ?? "—"}</span>,
              r.hasAnswerBlock ? "Yes" : "—",
              <span key="ov" className={scoreClass(r.overallScore)}>{r.overallScore ?? "—"}</span>,
            ],
          }))}
        />
      </div>
    </div>
  );
}
