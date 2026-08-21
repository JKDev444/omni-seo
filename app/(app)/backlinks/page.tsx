import { getBacklinksPageData } from "@/lib/data/backlinksPageData";

export const dynamic = "force-dynamic";

function fmtDateTime(d: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d);
}

export default async function BacklinksPage() {
  const data = await getBacklinksPageData();

  if (!data.site) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Backlinks</h1>
            <p className="page-subtitle">No site configured yet</p>
          </div>
        </div>
      </div>
    );
  }

  if (data.profiles.length === 0) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Backlinks</h1>
            <p className="page-subtitle">Not run yet</p>
          </div>
        </div>
        <div className="card">
          <h2 className="card-title">Backlink profile + competitor link gap</h2>
          <p className="empty-state" style={{ marginBottom: "var(--space-4)" }}>
            Pulls your domain&apos;s backlink summary (rank, referring domains, spam score) alongside named local
            competitors, then computes real backlink gap opportunities — domains linking to a competitor but not to
            you — as a concrete outreach list.
          </p>
          <ol style={{ paddingLeft: "var(--space-5)", fontSize: "var(--text-sm)", color: "var(--color-ink-muted)", lineHeight: 1.8 }}>
            <li>Set <code>DATAFORSEO_LOGIN</code> / <code>DATAFORSEO_PASSWORD</code></li>
            <li>Run <code>npx tsx scripts/runBacklinksCheck.ts</code></li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Backlinks</h1>
          <p className="page-subtitle">Your profile vs. local competitors, plus real outreach opportunities</p>
        </div>
        <div className="page-meta">Last checked: {fmtDateTime(data.profiles[0].fetchedAt)}</div>
      </div>

      <div className="section card">
        <h2 className="card-title">Domain comparison</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Domain</th>
              <th>Rank</th>
              <th>Backlinks</th>
              <th>Referring domains</th>
              <th>Nofollow</th>
              <th>Broken</th>
              <th>Spam score</th>
            </tr>
          </thead>
          <tbody>
            {data.profiles.map((p) => (
              <tr key={p.domain}>
                <td>{p.isOwnDomain ? <strong>{p.domain} (you)</strong> : p.domain}</td>
                <td className="num">{p.rank ?? "—"}</td>
                <td className="num">{p.backlinks ?? "—"}</td>
                <td className="num">{p.referringDomains ?? "—"}</td>
                <td className="num">{p.referringDomainsNofollow ?? "—"}</td>
                <td className="num">{p.brokenBacklinks ?? "—"}</td>
                <td className={`num ${(p.spamScore ?? 0) >= 30 ? "status-pending" : ""}`}>{p.spamScore ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.gap.length > 0 && (
        <div className="section card">
          <h2 className="card-title">Backlink gap — domains linking to a competitor but not to you</h2>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-ink-muted)", marginBottom: "var(--space-3)" }}>
            {data.gap.length} outreach opportunities, sorted by the referring domain&apos;s authority (highest first).
          </p>
          <table className="table">
            <thead>
              <tr>
                <th>Referring domain</th>
                <th>Domain rank</th>
                <th>Links to competitor</th>
                <th>Competitor</th>
              </tr>
            </thead>
            <tbody>
              {data.gap.slice(0, 100).map((g, i) => (
                <tr key={`${g.referringDomain}-${g.competitorDomain}-${i}`}>
                  <td>{g.referringDomain}</td>
                  <td className="num">{g.referringDomainRank ?? "—"}</td>
                  <td className="num">{g.backlinksToCompetitor ?? "—"}</td>
                  <td>{g.competitorDomain}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
