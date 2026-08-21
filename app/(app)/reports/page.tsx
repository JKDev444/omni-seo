import { getClientReportPageData } from "@/lib/data/clientReportPageData";

export const dynamic = "force-dynamic";

function fmtMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));
}

const SECTIONS: { key: "technicalHealth" | "contentImprovements" | "localSeo" | "performance" | "rankingsTraffic" | "leadsConversions" | "nextMonthPriorities"; label: string }[] = [
  { key: "technicalHealth", label: "Technical Health" },
  { key: "contentImprovements", label: "Content Improvements" },
  { key: "localSeo", label: "Local SEO" },
  { key: "performance", label: "Performance" },
  { key: "rankingsTraffic", label: "Rankings & Traffic" },
  { key: "leadsConversions", label: "Leads & Conversions" },
  { key: "nextMonthPriorities", label: "Next Month's Priorities" },
];

export default async function ReportsPage() {
  const data = await getClientReportPageData();

  if (!data.site) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Reports</h1>
            <p className="page-subtitle">No site configured yet</p>
          </div>
        </div>
      </div>
    );
  }

  if (data.reports.length === 0) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Reports</h1>
            <p className="page-subtitle">Not generated yet</p>
          </div>
        </div>
        <div className="card">
          <h2 className="card-title">Monthly report, written from real data</h2>
          <p className="empty-state" style={{ marginBottom: "var(--space-4)" }}>
            A plain-English summary generated from your actual crawl findings, Scorecard, GSC/GA4 trends, keyword
            movement, citations, and GBP data — the same report the Maintenance checklist&apos;s Week 4 task expects
            you to send. Every number in it is real; nothing is estimated or invented (leads/conversions has no
            data source connected, so that section says so honestly rather than guessing).
          </p>
          <ol style={{ paddingLeft: "var(--space-5)", fontSize: "var(--text-sm)", color: "var(--color-ink-muted)", lineHeight: 1.8 }}>
            <li>Set <code>ANTHROPIC_API_KEY</code></li>
            <li>Run <code>npx tsx scripts/generateClientReport.ts</code></li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Monthly summary, written from real data — nothing estimated or invented</p>
        </div>
      </div>

      {data.reports.map((r) => (
        <div key={r.month} className="section card">
          <h2 className="card-title">{fmtMonth(r.month)}</h2>
          {SECTIONS.map(({ key, label }) => (
            <div key={key} style={{ marginBottom: "var(--space-4)" }}>
              <h3 style={{ fontSize: "var(--text-sm)", fontWeight: 600, marginBottom: "var(--space-1)" }}>{label}</h3>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--color-ink-muted)" }}>{r[key] ?? "—"}</p>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
