import { prisma } from "@/lib/db";
import { V1_DOMAIN } from "@/lib/data/dashboard";

export interface RichResultsIssueRow {
  richResultType: string;
  itemName: string | null;
  severity: string | null;
  issueMessage: string | null;
}

export interface IndexationRow {
  url: string;
  googleStatus: string;
  ourStatusCode: number | null;
  ourNoindex: boolean;
  mismatch: boolean;
  lastCrawlTime: Date | null;
  verdict: string | null;
  coverageState: string | null;
  robotsTxtState: string | null;
  indexingState: string | null;
  googleCanonical: string | null;
  userCanonical: string | null;
  richResultsVerdict: string | null;
  richResultsIssues: RichResultsIssueRow[];
}

export interface IndexationData {
  site: { id: string; gscSiteUrl: string | null } | null;
  connected: boolean;
  lastRunAt: Date | null;
  counts: Record<string, number>;
  mismatches: IndexationRow[];
  rows: IndexationRow[];
  richResultsFailures: IndexationRow[];
}

export async function getIndexationData(): Promise<IndexationData> {
  const site = await prisma.site.findUnique({ where: { domain: V1_DOMAIN } });
  if (!site) return { site: null, connected: false, lastRunAt: null, counts: {}, mismatches: [], rows: [], richResultsFailures: [] };

  const inspections = await prisma.urlInspection.findMany({ where: { siteId: site.id }, orderBy: { url: "asc" } });
  if (inspections.length === 0) {
    return {
      site: { id: site.id, gscSiteUrl: site.gscSiteUrl },
      connected: !!site.gscSiteUrl,
      lastRunAt: null,
      counts: {},
      mismatches: [],
      rows: [],
      richResultsFailures: [],
    };
  }

  const pages = await prisma.page.findMany({ where: { siteId: site.id }, select: { url: true, statusCode: true } });
  const pageByUrl = new Map(pages.map((p) => [p.url, p]));

  const counts: Record<string, number> = {};
  const rows: IndexationRow[] = [];

  for (const insp of inspections) {
    counts[insp.normalizedStatus] = (counts[insp.normalizedStatus] ?? 0) + 1;

    const ourPage = pageByUrl.get(insp.url);
    // "We think it's fine (200, no block) but Google disagrees" is the
    // genuinely useful correlation — the exact case called out in the plan.
    // "Not Yet Discovered" is excluded here on purpose: it just means
    // Google hasn't crawled a newly-found page yet, not a real
    // disagreement — nothing to act on, so it doesn't belong in the same
    // list as an actual noindex/canonical problem.
    const weExpectIndexable = !ourPage || (ourPage.statusCode !== null && ourPage.statusCode < 400);
    const mismatch = weExpectIndexable && insp.normalizedStatus !== "Indexed" && insp.normalizedStatus !== "Not Yet Discovered";

    rows.push({
      url: insp.url,
      googleStatus: insp.normalizedStatus,
      ourStatusCode: ourPage?.statusCode ?? null,
      ourNoindex: false, // findings already cover this separately; kept for future use
      mismatch,
      lastCrawlTime: insp.lastCrawlTime,
      verdict: insp.verdict,
      coverageState: insp.coverageState,
      robotsTxtState: insp.robotsTxtState,
      indexingState: insp.indexingState,
      googleCanonical: insp.googleCanonical,
      userCanonical: insp.userCanonical,
      richResultsVerdict: insp.richResultsVerdict,
      richResultsIssues: (insp.richResultsIssues as unknown as RichResultsIssueRow[] | null) ?? [],
    });
  }

  return {
    site: { id: site.id, gscSiteUrl: site.gscSiteUrl },
    connected: true,
    lastRunAt: inspections.reduce<Date | null>((max, i) => (!max || i.fetchedAt > max ? i.fetchedAt : max), null),
    counts,
    mismatches: rows.filter((r) => r.mismatch),
    rows,
    richResultsFailures: rows.filter((r) => r.richResultsIssues.some((i) => i.severity === "ERROR")),
  };
}
