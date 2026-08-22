/**
 * Phase R: full SEO change tracking -- logs every title/meta description/
 * canonical/H1/status code/schema-type-set change between consecutive
 * crawls, not just the subset regressionDetection.ts flags as a
 * regression. That module answers "what got worse"; this one answers
 * "what changed at all", the complete audit trail a Finding-based system
 * can't give you (Findings only exist for detected problems, not neutral
 * or positive changes like a deliberately rewritten title).
 */
import { prisma } from "@/lib/db";

interface SnapshotFields {
  pageId: string;
  statusCode: number | null;
  title: string | null;
  metaDesc: string | null;
  canonical: string | null;
  h1: string | null;
  schemaTypes: string[];
}

const SCALAR_FIELDS = ["title", "metaDesc", "canonical", "h1"] as const;

/** Sitewide: diffs this crawl's snapshots against the site's previous completed crawl and writes one row per changed field. */
export async function logSeoChanges(siteId: string, currentCrawlId: string): Promise<number> {
  const previousCrawl = await prisma.crawl.findFirst({
    where: { siteId, status: "completed", id: { not: currentCrawlId } },
    orderBy: { startedAt: "desc" },
  });
  if (!previousCrawl) return 0; // first crawl for this site -- nothing to diff against

  const [prevSnapshots, currSnapshots] = await Promise.all([
    prisma.pageSnapshot.findMany({ where: { crawlId: previousCrawl.id } }),
    prisma.pageSnapshot.findMany({ where: { crawlId: currentCrawlId } }),
  ]);

  const prevByPageId = new Map<string, SnapshotFields>(prevSnapshots.map((s) => [s.pageId, s]));

  const rows: { siteId: string; pageId: string; crawlId: string; field: string; oldValue: string | null; newValue: string | null }[] = [];

  for (const curr of currSnapshots) {
    const prev = prevByPageId.get(curr.pageId);
    if (!prev) continue; // page is new this crawl -- nothing to diff against

    for (const field of SCALAR_FIELDS) {
      const oldValue = prev[field];
      const newValue = curr[field];
      if (oldValue !== newValue) {
        rows.push({ siteId, pageId: curr.pageId, crawlId: currentCrawlId, field, oldValue, newValue });
      }
    }

    const oldStatus = prev.statusCode?.toString() ?? null;
    const newStatus = curr.statusCode?.toString() ?? null;
    if (oldStatus !== newStatus) {
      rows.push({ siteId, pageId: curr.pageId, crawlId: currentCrawlId, field: "statusCode", oldValue: oldStatus, newValue: newStatus });
    }

    const prevSchema = [...prev.schemaTypes].sort();
    const currSchema = [...curr.schemaTypes].sort();
    if (prevSchema.join(",") !== currSchema.join(",")) {
      rows.push({
        siteId,
        pageId: curr.pageId,
        crawlId: currentCrawlId,
        field: "schemaTypes",
        oldValue: prevSchema.join(", ") || null,
        newValue: currSchema.join(", ") || null,
      });
    }
  }

  if (rows.length > 0) {
    await prisma.seoChangeLog.createMany({ data: rows });
  }

  return rows.length;
}
