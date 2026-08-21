import { getIndexationData, type IndexationRow } from "@/lib/data/indexation";
import { FilterableTable } from "@/components/FilterableTable";

export const dynamic = "force-dynamic";

const STATUS_ORDER = [
  "Indexed",
  "Not Indexed",
  "Blocked",
  "Canonical Mismatch",
  "Discovered - Not Indexed",
  "Crawled - Not Indexed",
  "Not Yet Discovered",
];

function fmtDateTime(d: Date | null): string {
  if (!d) return "never";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(d);
}

function pathFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname === "/" ? "/" : u.pathname;
  } catch {
    return url;
  }
}

/** Translates the raw URL Inspection API fields into a plain-English "why", so a blocked/mismatched page is actionable, not just labeled. */
function diagnose(r: IndexationRow): string {
  if (r.robotsTxtState === "DISALLOWED") return "robots.txt disallows this URL for Googlebot.";
  // INDEXING_STATE_UNSPECIFIED just means "not evaluated yet" (a new or
  // not-yet-indexed page) -- a real deliberate block always has a specific
  // reason (BLOCKED_BY_META_TAG, BLOCKED_BY_ROBOTS_TXT, etc), so only
  // treat those as a "block" explanation; fall through to coverageState
  // (Google's own plain-English message) for everything else.
  if (r.indexingState && r.indexingState !== "INDEXING_ALLOWED" && r.indexingState !== "INDEXING_STATE_UNSPECIFIED") {
    const reason = r.indexingState.replace(/^BLOCKED_BY_/, "").replace(/_/g, " ").toLowerCase();
    return `Blocked by ${reason}.`;
  }
  if (r.googleStatus === "Canonical Mismatch" && r.googleCanonical) {
    return `Google is treating "${pathFromUrl(r.googleCanonical)}" as canonical instead of this URL${r.userCanonical && r.userCanonical !== r.googleCanonical ? ` (site declares "${pathFromUrl(r.userCanonical)}" as canonical)` : " (no canonical tag declared on this page)"}.`;
  }
  if (r.coverageState) return r.coverageState;
  if (r.verdict) return `Verdict: ${r.verdict}.`;
  return "No further detail from Google for this URL.";
}

export default async function IndexationPage() {
  const data = await getIndexationData();

  if (!data.site) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Indexation</h1>
            <p className="page-subtitle">No site configured yet</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data.connected || data.rows.length === 0) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Indexation</h1>
            <p className="page-subtitle">{data.connected ? "Not run yet" : "Not connected yet"}</p>
          </div>
        </div>
        <div className="card">
          <h2 className="card-title">Indexation Control Center</h2>
          <p className="empty-state">
            {data.connected
              ? "Search Console is connected, but the URL Inspection check hasn't run yet. Run npx tsx scripts/runIndexationCheck.ts to pull Google's actual index status for every crawled page."
              : "Uses the same service account as the Analytics page (Search Console access). Once gscSiteUrl is set and the service account has access, run npx tsx scripts/runIndexationCheck.ts to see what Google actually says about each page's index status — correlated against what our own crawler concluded."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Indexation</h1>
          <p className="page-subtitle">What Google says vs. what our crawler concluded</p>
        </div>
        <div className="page-meta">Last checked: {fmtDateTime(data.lastRunAt)}</div>
      </div>

      <div className="section rings-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
        {STATUS_ORDER.filter((s) => data.counts[s]).map((status) => (
          <div className="card" key={status}>
            <div className="ring-count">{status}</div>
            <div className="score data-value" style={{ fontSize: "var(--text-2xl)" }}>{data.counts[status]}</div>
          </div>
        ))}
      </div>

      {data.mismatches.length > 0 && (
        <div className="section card">
          <h2 className="card-title">Mismatches — we expected indexable, Google disagrees</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Page</th>
                <th>Our status code</th>
                <th>Google's status</th>
                <th>Why</th>
              </tr>
            </thead>
            <tbody>
              {data.mismatches.map((r) => (
                <tr key={r.url}>
                  <td>{pathFromUrl(r.url)}</td>
                  <td className="num">{r.ourStatusCode ?? "—"}</td>
                  <td>
                    <span className={r.googleStatus === "Blocked" || r.googleStatus === "Canonical Mismatch" ? "tier-badge tier-high" : "tier-badge tier-medium"}>
                      {r.googleStatus}
                    </span>
                  </td>
                  <td style={{ fontSize: "var(--text-sm)", color: "var(--color-ink-muted)" }}>{diagnose(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="section card">
        <h2 className="card-title">All inspected pages</h2>
        <FilterableTable
          headers={["Page", "Google's status"]}
          searchPlaceholder="Search pages…"
          rows={data.rows.map((r) => ({
            key: r.url,
            searchText: `${pathFromUrl(r.url)} ${r.googleStatus}`,
            cells: [pathFromUrl(r.url), r.googleStatus],
          }))}
        />
      </div>
    </div>
  );
}
