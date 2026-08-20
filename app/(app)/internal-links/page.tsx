import { getInternalLinksData } from "@/lib/data/internalLinks";

export const dynamic = "force-dynamic";

function pathFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname === "/" ? "/" : u.pathname;
  } catch {
    return url;
  }
}

export default async function InternalLinksPage() {
  const data = await getInternalLinksData();

  if (!data.site) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Internal Links</h1>
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
            <h1 className="page-title">Internal Links</h1>
            <p className="page-subtitle">Not available yet</p>
          </div>
        </div>
        <div className="card">
          <p className="empty-state">
            Run a crawl (<code>npx tsx scripts/runCrawl.ts</code>) to build the internal link graph — orphan pages,
            crawl depth, and an authority score per page based on contextual inbound links.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Internal Links</h1>
          <p className="page-subtitle">Orphan pages, crawl depth, and internal authority</p>
        </div>
      </div>

      <div className="section rings-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
        <div className="card">
          <div className="ring-count" style={{ color: data.orphanCount > 0 ? "var(--color-critical)" : undefined }}>Orphan pages</div>
          <div className="score data-value" style={{ fontSize: "var(--text-2xl)" }}>{data.orphanCount}</div>
        </div>
        <div className="card">
          <div className="ring-count">Deepest page</div>
          <div className="score data-value" style={{ fontSize: "var(--text-2xl)" }}>{data.maxDepth ?? "—"} clicks</div>
        </div>
        <div className="card">
          <div className="ring-count">Total pages</div>
          <div className="score data-value" style={{ fontSize: "var(--text-2xl)" }}>{data.stats.length}</div>
        </div>
      </div>

      {data.suggestions.length > 0 && (
        <div className="section card">
          <h2 className="card-title">Link suggestions — under-linked money pages</h2>
          {data.suggestions.map((sg) => (
            <div className="finding-row" key={sg.targetUrl}>
              <div className="finding-title">{pathFromUrl(sg.targetUrl)}</div>
              <div className="finding-desc">
                Add a contextual link from: {sg.suggestedSources.map(pathFromUrl).join(", ")}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="section card">
        <h2 className="card-title">All pages — sorted by authority score (lowest first)</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Page</th>
              <th>Type</th>
              <th>Depth</th>
              <th>Inbound (contextual)</th>
              <th>Authority</th>
            </tr>
          </thead>
          <tbody>
            {data.stats.map((s) => (
              <tr key={s.url}>
                <td>
                  {pathFromUrl(s.url)}
                  {s.isOrphan && <span className="tier-badge tier-high" style={{ marginLeft: "var(--space-2)" }}>Orphan</span>}
                </td>
                <td>{s.pageType}</td>
                <td className="num">{s.depth ?? "unreachable"}</td>
                <td className="num">{s.inboundTotal} ({s.inboundContextual})</td>
                <td className="num">{s.authorityScore}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
