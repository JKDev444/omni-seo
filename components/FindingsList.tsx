import type { Priority } from "@prisma/client";
import type { FindingWithPage } from "@/lib/data/dashboard";

const PRIORITY_ORDER: Priority[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

const TIER_CLASS: Record<Priority, string> = {
  CRITICAL: "tier-critical",
  HIGH: "tier-high",
  MEDIUM: "tier-medium",
  LOW: "tier-low",
};

const TIER_LABEL: Record<Priority, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

function pathFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname === "/" ? "/" : u.pathname;
  } catch {
    return url;
  }
}

export function FindingsList({
  findingsByPriority,
}: {
  findingsByPriority: Record<Priority, FindingWithPage[]>;
}) {
  const total = PRIORITY_ORDER.reduce((sum, p) => sum + findingsByPriority[p].length, 0);

  if (total === 0) {
    return (
      <div className="card">
        <h2 className="card-title">Findings</h2>
        <p className="empty-state">No open findings — run a crawl to populate this list.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="card-title">Findings by priority</h2>
      {PRIORITY_ORDER.map((priority) => {
        const findings = findingsByPriority[priority];
        if (findings.length === 0) return null;
        return (
          <div className="findings-group" key={priority}>
            <div className="findings-group-header">
              <span className={`tier-badge ${TIER_CLASS[priority]}`}>{TIER_LABEL[priority]}</span>
              <span className="findings-group-count">{findings.length}</span>
            </div>
            {findings.map((f) => (
              <div className="finding-row" key={f.id}>
                <div className="finding-title">{f.title}</div>
                <div className="finding-desc">{f.description}</div>
                <div className="finding-meta">
                  <span>{f.checkStep}</span>
                  {f.page && <span>{pathFromUrl(f.page.url)}</span>}
                  {f.owner && <span>owner: {f.owner}</span>}
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
