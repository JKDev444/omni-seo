import { getDashboardData } from "@/lib/data/dashboard";
import { HealthRing } from "@/components/HealthRing";
import { FindingsList } from "@/components/FindingsList";
import { ScorecardTable } from "@/components/ScorecardTable";
import { CitationTracker } from "@/components/CitationTracker";
import { MaintenanceTracker } from "@/components/MaintenanceTracker";

export const dynamic = "force-dynamic";

function fmtDateTime(d: Date | null | undefined): string {
  if (!d) return "never";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  if (!data.site) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">No site configured yet</p>
          </div>
        </div>
        <div className="card">
          <p className="empty-state">
            The <code>omnicenters.com</code> site record doesn&apos;t exist in the database yet. Run{" "}
            <code>npm run db:push</code> then <code>npm run db:seed</code> to populate sample data.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Site health</h1>
          <p className="page-subtitle">
            {data.site.domain} · {data.site.platform} · {data.totalOpenFindings} open finding
            {data.totalOpenFindings === 1 ? "" : "s"}
          </p>
        </div>
        <div className="page-meta">
          Last crawl: {fmtDateTime(data.latestCrawl?.finishedAt ?? data.latestCrawl?.startedAt)}
          <br />
          {data.latestCrawl ? `${data.latestCrawl.pagesFound} pages crawled` : "no crawl run yet"}
        </div>
      </div>

      <div className="section rings-grid">
        {data.rings.map((ring) => (
          <HealthRing key={ring.label} ring={ring} />
        ))}
      </div>

      <div className="section two-col">
        <div id="findings">
          <FindingsList findingsByPriority={data.findingsByPriority} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          <ScorecardTable rows={data.scorecard} />
          <CitationTracker rows={data.citations} />
        </div>
      </div>

      <div className="section">
        <MaintenanceTracker
          month={data.maintenance.month}
          activeWeek={data.maintenance.activeWeek}
          tasks={data.maintenance.tasks}
        />
      </div>
    </div>
  );
}
