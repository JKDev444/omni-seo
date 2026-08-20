import { getContentStacksPageData } from "@/lib/data/contentStacksPageData";

export const dynamic = "force-dynamic";

function pathFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname === "/" ? "/" : u.pathname;
  } catch {
    return url;
  }
}

function scoreClass(score: number): string {
  if (score >= 70) return "status-completed";
  if (score >= 40) return "status-pending";
  return "";
}

const ROLE_LABELS: Record<string, string> = {
  PILLAR: "Pillar",
  SERVICE_PAGE: "Service page",
  SUPPORTING_ARTICLE: "Supporting article",
};

export default async function ContentStacksPage() {
  const data = await getContentStacksPageData();

  if (!data.site) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Content Stacks</h1>
            <p className="page-subtitle">No site configured yet</p>
          </div>
        </div>
      </div>
    );
  }

  if (data.stacks.length === 0) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Content Stacks</h1>
            <p className="page-subtitle">Not run yet</p>
          </div>
        </div>
        <div className="card">
          <h2 className="card-title">Topical authority / content cluster completeness</h2>
          <p className="empty-state" style={{ marginBottom: "var(--space-4)" }}>
            Groups crawled service pages and blog articles into per-treatment content stacks (pillar page +
            supporting articles), then scores each stack: pillar present, supporting article coverage, two-way
            internal linking between stack members, and orphans within the stack. Uses a single LLM call across all
            pages (not per-page) to cluster by topic — a small, one-time cost per run.
          </p>
          <ol style={{ paddingLeft: "var(--space-5)", fontSize: "var(--text-sm)", color: "var(--color-ink-muted)", lineHeight: 1.8 }}>
            <li>Set <code>ANTHROPIC_API_KEY</code></li>
            <li>Run <code>npx tsx scripts/runContentStackClustering.ts</code></li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Content Stacks</h1>
          <p className="page-subtitle">Topical authority — pillar, service pages, supporting articles, internal linking</p>
        </div>
        <div className="page-meta">Avg completeness: {data.avgCompleteness ?? "—"}</div>
      </div>

      {data.stacks.map((stack) => (
        <div key={stack.topic} className="section card">
          <h2 className="card-title">
            {stack.topic} —{" "}
            <span className={scoreClass(stack.completenessScore)}>{stack.completenessScore}/100</span>
          </h2>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-ink-muted)", marginBottom: "var(--space-3)" }}>
            {stack.pillarUrl ? "Pillar present" : "No pillar identified"} · {stack.servicePageCount} service page(s) ·{" "}
            {stack.supportingArticleCount} supporting article(s) · {stack.linkedMemberCount}/{stack.memberCount} linked
            within the stack · {stack.orphanCount} orphan(s)
          </p>
          <table className="table">
            <thead>
              <tr>
                <th>Page</th>
                <th>Role</th>
                <th>Linked to/from stack</th>
              </tr>
            </thead>
            <tbody>
              {stack.members.map((m) => (
                <tr key={m.url}>
                  <td>{pathFromUrl(m.url)}</td>
                  <td>{ROLE_LABELS[m.role] ?? m.role}</td>
                  <td className={m.hasInboundFromStack || m.hasOutboundToStack ? "" : "status-pending"}>
                    {m.hasInboundFromStack && m.hasOutboundToStack
                      ? "Two-way"
                      : m.hasInboundFromStack
                        ? "Inbound only"
                        : m.hasOutboundToStack
                          ? "Outbound only"
                          : "Not linked"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
