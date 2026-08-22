import { getChangeLogData } from "@/lib/data/changeLog";
import { FilterableTable } from "@/components/FilterableTable";

export const dynamic = "force-dynamic";

const FIELD_LABEL: Record<string, string> = {
  title: "Title tag",
  metaDesc: "Meta description",
  canonical: "Canonical tag",
  h1: "H1",
  statusCode: "Status code",
  schemaTypes: "Schema types",
};

function pathFromUrl(url: string | null): string {
  if (!url) return "(page deleted)";
  try {
    const u = new URL(url);
    return u.pathname === "/" ? "/" : u.pathname;
  } catch {
    return url;
  }
}

function fmtDateTime(d: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(d);
}

function truncate(v: string | null, max = 60): string {
  if (v === null) return "(none)";
  return v.length > max ? `${v.slice(0, max)}…` : v;
}

export default async function ChangeLogPage() {
  const data = await getChangeLogData();

  if (!data.site) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Change Log</h1>
            <p className="page-subtitle">No site configured yet</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Change Log</h1>
          <p className="page-subtitle">Every title/meta/canonical/H1/status/schema change, crawl over crawl — not just regressions</p>
        </div>
        <div className="page-meta">{data.totalCount} total changes recorded</div>
      </div>

      {data.entries.length === 0 ? (
        <div className="card">
          <p className="empty-state">
            No changes recorded yet — this fills in once at least two crawls have run, since a change is only
            meaningful relative to a previous state. See <code>lib/checks/changeTracking.ts</code>, wired into every
            crawl.
          </p>
        </div>
      ) : (
        <div className="section card">
          <h2 className="card-title">
            Recent changes {data.totalCount > data.entries.length ? `(showing latest ${data.entries.length} of ${data.totalCount})` : ""}
          </h2>
          <FilterableTable
            headers={["When", "Page", "Field", "Old value", "New value"]}
            searchPlaceholder="Search by page or field…"
            rows={data.entries.map((e) => ({
              key: e.id,
              searchText: `${pathFromUrl(e.pageUrl)} ${FIELD_LABEL[e.field] ?? e.field}`,
              cells: [fmtDateTime(e.detectedAt), pathFromUrl(e.pageUrl), FIELD_LABEL[e.field] ?? e.field, truncate(e.oldValue), truncate(e.newValue)],
            }))}
          />
        </div>
      )}
    </div>
  );
}
