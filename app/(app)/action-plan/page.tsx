import { getActionPlanData, type FindingWithPage } from "@/lib/data/actionPlan";
import { updateFindingStatus } from "@/lib/actions/findingActions";
import { FIX_LOCATION_GUIDE, type RoadmapBucket } from "@/lib/data/roadmapPlan";

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

const PRIORITY_BORDER: Record<FindingWithPage["priority"], string> = {
  CRITICAL: "var(--color-critical)",
  HIGH: "var(--color-warning)",
  MEDIUM: "var(--color-accent)",
  LOW: "var(--color-border-strong)",
};

function FindingCard({ f }: { f: FindingWithPage }) {
  const markDone = updateFindingStatus.bind(null, f.id, "COMPLETED");
  const ignore = updateFindingStatus.bind(null, f.id, "IGNORED");
  const falsePositive = updateFindingStatus.bind(null, f.id, "FALSE_POSITIVE");
  const guide = f.fixLocation ? FIX_LOCATION_GUIDE[f.fixLocation] : undefined;

  return (
    <div className="finding-card" style={{ borderLeftColor: PRIORITY_BORDER[f.priority] }}>
      <span className={`tier-badge tier-${f.priority.toLowerCase()}`}>{f.priority}</span>
      <div className="finding-card-body">
        <p className="finding-card-title">{f.title}</p>
        <p className="finding-card-desc">{f.description}</p>
        {f.fixType && (
          <p style={{ fontSize: "var(--text-sm)", margin: "0 0 var(--space-1)" }}>
            <strong>Fix:</strong> {f.fixType} {f.fixLocation && <span style={{ color: "var(--color-ink-muted)" }}>({f.fixLocation})</span>}
          </p>
        )}
        {guide && (
          <details style={{ fontSize: "var(--text-sm)", margin: "0 0 var(--space-1)" }}>
            <summary style={{ cursor: "pointer", color: "var(--color-ink-muted)" }}>Exactly where to fix this</summary>
            <p style={{ margin: "var(--space-1) 0 2px", color: "var(--color-ink-muted)" }}>{guide.where}</p>
            <ol style={{ paddingLeft: "var(--space-5)", color: "var(--color-ink-muted)", margin: 0 }}>
              {guide.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </details>
        )}
        {f.page && <span className="finding-card-page">{pathFromUrl(f.page.url)}</span>}
      </div>
      <div className="finding-card-actions">
        <form action={markDone}>
          <button type="submit" className="action-btn action-btn-done">
            Mark done
          </button>
        </form>
        <form action={ignore}>
          <button type="submit" className="action-btn">
            Ignore
          </button>
        </form>
        <form action={falsePositive}>
          <button type="submit" className="action-btn">
            False positive
          </button>
        </form>
      </div>
    </div>
  );
}

function CHECKSTEP_LABEL(checkStep: string): string {
  return checkStep.replace(/^Step \d+ - /, "").replace(/^Technical SEO Engine - /, "");
}

const ROADMAP_RING_COLOR: Record<string, string> = {
  "1–30": "var(--color-critical)",
  "31–60": "var(--color-warning)",
  "61–90": "var(--color-ink-faint)",
};

function RoadmapCard({ bucket, maxCount }: { bucket: RoadmapBucket; maxCount: number }) {
  const ringColor = ROADMAP_RING_COLOR[bucket.dayRange] ?? "var(--color-accent)";
  const circumference = 2 * Math.PI * 16;
  const fraction = maxCount > 0 ? bucket.count / maxCount : 0;
  const dash = `${(fraction * circumference).toFixed(1)} ${circumference.toFixed(1)}`;

  return (
    <div className="card roadmap-tile">
      <div className="roadmap-tile-top">
        <span className="roadmap-range">Days {bucket.dayRange}</span>
        <svg width="40" height="40" viewBox="0 0 40 40" className="roadmap-ring">
          <circle cx="20" cy="20" r="16" fill="none" stroke="var(--color-surface-sunken)" strokeWidth="4" />
          <circle
            cx="20"
            cy="20"
            r="16"
            fill="none"
            stroke={ringColor}
            strokeWidth="4"
            strokeDasharray={dash}
            strokeLinecap="round"
            transform="rotate(-90 20 20)"
          />
        </svg>
      </div>
      <div className="roadmap-count data-value">{bucket.count}</div>
      <p style={{ fontSize: "var(--text-sm)", fontWeight: 600, margin: "0 0 6px" }}>{bucket.label.split(": ")[1] ?? bucket.label}</p>
      <p style={{ fontSize: "var(--text-xs)", color: "var(--color-ink-muted)", margin: "0 0 4px" }}>
        {bucket.quickWinCount > 0 ? `${bucket.quickWinCount} are quick, mechanical fixes` : "mostly content/authority work"}
      </p>
      {bucket.suggestedPerWeek > 0 && (
        <p style={{ fontSize: "var(--text-xs)", color: "var(--color-ink-faint)", margin: "0 0 var(--space-2)" }}>
          ~{bucket.suggestedPerWeek}/week keeps this on pace
        </p>
      )}
      {bucket.topCategories.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: "var(--text-xs)", color: "var(--color-ink-faint)" }}>
          {bucket.topCategories.map((c) => (
            <li key={c.checkStep} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
              <span>{CHECKSTEP_LABEL(c.checkStep)}</span>
              <span style={{ fontFamily: "var(--font-mono)" }}>{c.count}</span>
            </li>
          ))}
        </ul>
      )}
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

      <div className="section stat-row">
        <div className="stat-card">
          <div className="stat-label"><span className="stat-dot" style={{ background: "var(--color-critical)" }} />Critical</div>
          <div className="stat-value data-value">{data.counts.critical}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><span className="stat-dot" style={{ background: "var(--color-warning)" }} />High</div>
          <div className="stat-value data-value">{data.counts.high}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><span className="stat-dot" style={{ background: "var(--color-accent)" }} />Medium</div>
          <div className="stat-value data-value">{data.counts.medium}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><span className="stat-dot" style={{ background: "var(--color-ink-faint)" }} />Low</div>
          <div className="stat-value data-value">{data.counts.low}</div>
        </div>
      </div>

      <div className="section">
        <h2 className="section-label">Your 30/60/90-day plan</h2>
        <div className="roadmap-row">
          {(() => {
            const maxCount = Math.max(data.roadmap.day30.count, data.roadmap.day60.count, data.roadmap.day90.count, 1);
            return (
              <>
                <RoadmapCard bucket={data.roadmap.day30} maxCount={maxCount} />
                <RoadmapCard bucket={data.roadmap.day60} maxCount={maxCount} />
                <RoadmapCard bucket={data.roadmap.day90} maxCount={maxCount} />
              </>
            );
          })()}
        </div>
      </div>

      {data.doNow.length > 0 && (
        <div className="section">
          <h2 className="section-label">Do now — critical &amp; high priority</h2>
          <div className="findings-card-list">
            {data.doNow.map((f) => (
              <FindingCard key={f.id} f={f} />
            ))}
          </div>
        </div>
      )}

      {(data.thisMonth.findings.length > 0 ||
        data.thisMonth.ctrRewrites.length > 0 ||
        data.thisMonth.contentStackGaps.length > 0 ||
        data.thisMonth.backlinkOutreach.length > 0) && (
        <div className="section">
          <h2 className="section-label">This month</h2>

          {data.thisMonth.findings.length > 0 && (
            <div style={{ marginBottom: "var(--space-4)" }}>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--color-ink-muted)", marginBottom: "var(--space-2)" }}>
                Medium-priority findings — showing {data.thisMonth.findings.length} of {data.thisMonth.findingsTotal}
                {data.thisMonth.findingsTotal > data.thisMonth.findings.length && (
                  <> — see <a href="/dashboard#findings">Overview &gt; Findings</a> for the complete list</>
                )}
              </p>
              <div className="findings-card-list">
                {data.thisMonth.findings.map((f) => (
                  <FindingCard key={f.id} f={f} />
                ))}
              </div>
            </div>
          )}

          {data.thisMonth.ctrRewrites.length > 0 && (
            <div className="card" style={{ marginBottom: "var(--space-4)" }}>
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
            <div className="card" style={{ marginBottom: "var(--space-4)" }}>
              <h3 style={{ fontSize: "var(--text-sm)", color: "var(--color-ink-muted)", marginBottom: "var(--space-1)" }}>
                Content clusters needing work ({data.thisMonth.contentStackGaps.length}) — see{" "}
                <a href="/content-stacks">Content Stacks</a> for full detail
              </h3>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--color-ink-faint)", marginBottom: "var(--space-3)" }}>
                Typical agency pace for a site this size is 2–4 published pieces a month — publishing consistently
                beats a single big batch, both for realistic execution and for reading which piece actually moved
                the needle.
              </p>
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
            <div className="card">
              <h3 style={{ fontSize: "var(--text-sm)", color: "var(--color-ink-muted)", marginBottom: "var(--space-1)" }}>
                Top backlink outreach targets — see <a href="/backlinks">Backlinks</a> for the full 150-domain list
              </h3>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--color-ink-faint)", marginBottom: "var(--space-3)" }}>
                Google has stated acquisition speed itself isn't a ranking factor — what matters is that each link is
                genuine. Pace outreach to what you can realistically research and personalize, not to hit a number.
              </p>
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
        <div className="section">
          <h2 className="section-label">Ongoing — {data.ongoing.maintenanceMonth} recurring tasks</h2>
          {data.ongoing.maintenanceTasks.length > 0 && (
            <div className="card" style={{ marginBottom: "var(--space-4)" }}>
              <table className="table">
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
            </div>
          )}
          {data.ongoing.findings.length > 0 && (
            <div>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--color-ink-muted)", marginBottom: "var(--space-2)" }}>
                Low-priority findings
              </p>
              <div className="findings-card-list">
                {data.ongoing.findings.map((f) => (
                  <FindingCard key={f.id} f={f} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
