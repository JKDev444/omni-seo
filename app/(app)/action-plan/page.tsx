import { getActionPlanData, type FindingWithPage } from "@/lib/data/actionPlan";

export const dynamic = "force-dynamic";

function pathFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname === "/" ? "/" : u.pathname;
  } catch {
    return url;
  }
}

function fmtDate(d: Date | null): string {
  if (!d) return "never";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d);
}

function FindingCard({ f }: { f: FindingWithPage }) {
  return (
    <div style={{ padding: "var(--space-3) 0", borderBottom: "1px solid var(--color-border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-2)" }}>
        <strong>{f.title}</strong>
        <span className={`tier-badge tier-${f.priority.toLowerCase()}`}>{f.priority}</span>
      </div>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--color-ink-muted)", margin: "var(--space-1) 0" }}>{f.description}</p>
      {f.fixType && (
        <p style={{ fontSize: "var(--text-sm)" }}>
          <strong>Fix:</strong> {f.fixType} {f.fixLocation && <span style={{ color: "var(--color-ink-muted)" }}>({f.fixLocation})</span>}
        </p>
      )}
      {f.page && <p style={{ fontSize: "var(--text-sm)", color: "var(--color-ink-muted)" }}>{pathFromUrl(f.page.url)}</p>}
    </div>
  );
}

export default async function ActionPlanPage() {
  const data = await getActionPlanData();

  if (!data.site) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Action Plan</h1>
            <p className="page-subtitle">No site configured yet</p>
          </div>
        </div>
      </div>
    );
  }

  const hasAnything =
    data.doNow.length > 0 ||
    data.thisMonth.findings.length > 0 ||
    data.thisMonth.ctrRewrites.length > 0 ||
    data.thisMonth.contentStackGaps.length > 0 ||
    data.thisMonth.backlinkOutreach.length > 0 ||
    data.ongoing.maintenanceTasks.length > 0;

  if (!hasAnything) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Action Plan</h1>
            <p className="page-subtitle">Nothing to show yet</p>
          </div>
        </div>
        <div className="card">
          <p className="empty-state">
            Run a crawl and the other data pulls (analytics, indexation, content review, keywords, content stacks,
            backlinks) first — this page pulls everything they find into one prioritized plan.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Action Plan</h1>
          <p className="page-subtitle">Everything that needs doing, prioritized — the one page to work from</p>
        </div>
        <div className="page-meta">Last crawl: {fmtDate(data.latestCrawlAt)}</div>
      </div>

      <div className="section rings-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" }}>
        <div className="card">
          <div className="ring-count">Critical</div>
          <div className="score data-value" style={{ fontSize: "var(--text-2xl)" }}>{data.counts.critical}</div>
        </div>
        <div className="card">
          <div className="ring-count">High</div>
          <div className="score data-value" style={{ fontSize: "var(--text-2xl)" }}>{data.counts.high}</div>
        </div>
        <div className="card">
          <div className="ring-count">Medium</div>
          <div className="score data-value" style={{ fontSize: "var(--text-2xl)" }}>{data.counts.medium}</div>
        </div>
        <div className="card">
          <div className="ring-count">Low</div>
          <div className="score data-value" style={{ fontSize: "var(--text-2xl)" }}>{data.counts.low}</div>
        </div>
      </div>

      {data.doNow.length > 0 && (
        <div className="section card">
          <h2 className="card-title">Do now — critical &amp; high priority</h2>
          {data.doNow.map((f) => (
            <FindingCard key={f.id} f={f} />
          ))}
        </div>
      )}

      {(data.thisMonth.findings.length > 0 ||
        data.thisMonth.ctrRewrites.length > 0 ||
        data.thisMonth.contentStackGaps.length > 0 ||
        data.thisMonth.backlinkOutreach.length > 0) && (
        <div className="section card">
          <h2 className="card-title">This month</h2>

          {data.thisMonth.findings.length > 0 && (
            <div style={{ marginBottom: "var(--space-4)" }}>
              <h3 style={{ fontSize: "var(--text-sm)", color: "var(--color-ink-muted)", marginBottom: "var(--space-2)" }}>
                Medium-priority findings
              </h3>
              {data.thisMonth.findings.map((f) => (
                <FindingCard key={f.id} f={f} />
              ))}
            </div>
          )}

          {data.thisMonth.ctrRewrites.length > 0 && (
            <div style={{ marginBottom: "var(--space-4)" }}>
              <h3 style={{ fontSize: "var(--text-sm)", color: "var(--color-ink-muted)", marginBottom: "var(--space-2)" }}>
                Title/meta rewrites ready to apply ({data.thisMonth.ctrRewrites.length}) — see{" "}
                <a href="/keywords">Keywords</a> for full detail
              </h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>Page</th>
                    <th>Suggested title</th>
                    <th>Impressions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.thisMonth.ctrRewrites.map((r) => (
                    <tr key={r.url}>
                      <td>{pathFromUrl(r.url)}</td>
                      <td>{r.suggestedTitle}</td>
                      <td className="num">{r.impressions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.thisMonth.contentStackGaps.length > 0 && (
            <div style={{ marginBottom: "var(--space-4)" }}>
              <h3 style={{ fontSize: "var(--text-sm)", color: "var(--color-ink-muted)", marginBottom: "var(--space-2)" }}>
                Content clusters needing work ({data.thisMonth.contentStackGaps.length}) — see{" "}
                <a href="/content-stacks">Content Stacks</a> for full detail
              </h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>Topic</th>
                    <th>Completeness</th>
                    <th>Pillar</th>
                    <th>Supporting articles</th>
                  </tr>
                </thead>
                <tbody>
                  {data.thisMonth.contentStackGaps.map((s) => (
                    <tr key={s.topic}>
                      <td>{s.topic}</td>
                      <td className="num">{s.completenessScore}</td>
                      <td>{s.pillarUrl ? pathFromUrl(s.pillarUrl) : "missing"}</td>
                      <td className="num">{s.supportingArticleCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.thisMonth.backlinkOutreach.length > 0 && (
            <div>
              <h3 style={{ fontSize: "var(--text-sm)", color: "var(--color-ink-muted)", marginBottom: "var(--space-2)" }}>
                Top backlink outreach targets — see <a href="/backlinks">Backlinks</a> for the full 150-domain list
              </h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>Referring domain</th>
                    <th>Rank</th>
                    <th>Currently links to</th>
                  </tr>
                </thead>
                <tbody>
                  {data.thisMonth.backlinkOutreach.map((b, i) => (
                    <tr key={`${b.referringDomain}-${i}`}>
                      <td>{b.referringDomain}</td>
                      <td className="num">{b.referringDomainRank ?? "—"}</td>
                      <td>{b.competitorDomain}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {(data.ongoing.maintenanceTasks.length > 0 || data.ongoing.findings.length > 0) && (
        <div className="section card">
          <h2 className="card-title">Ongoing — {data.ongoing.maintenanceMonth} recurring tasks</h2>
          {data.ongoing.maintenanceTasks.length > 0 && (
            <table className="table" style={{ marginBottom: "var(--space-4)" }}>
              <thead>
                <tr>
                  <th>Week</th>
                  <th>Area</th>
                  <th>Task</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.ongoing.maintenanceTasks.map((t) => (
                  <tr key={t.id}>
                    <td className="num">{t.week}</td>
                    <td>{t.area}</td>
                    <td>{t.task}</td>
                    <td>{t.status.replace("_", " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {data.ongoing.findings.length > 0 && (
            <div>
              <h3 style={{ fontSize: "var(--text-sm)", color: "var(--color-ink-muted)", marginBottom: "var(--space-2)" }}>
                Low-priority findings
              </h3>
              {data.ongoing.findings.map((f) => (
                <FindingCard key={f.id} f={f} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
