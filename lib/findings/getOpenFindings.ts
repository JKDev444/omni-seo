/**
 * The correct definition of "open findings" for a site -- NOT "findings
 * attached to the latest crawl."
 *
 * Real bug this fixes: crawl.ts's own checks re-run on every crawl and
 * create fresh Finding rows each time, but the LLM-based checks
 * (content review, AI Search Readiness, etc.) run on a separate,
 * slower cadence via their own scripts, each attaching findings to
 * whatever crawl was "latest" AT THE TIME they ran. The moment any
 * later crawl runs for an unrelated reason, those findings become
 * orphaned on a now-stale crawlId -- and every page that filtered
 * findings by `crawlId: latestCrawl.id` (Dashboard, Action Plan) lost
 * visibility into them entirely, even though the underlying issue was
 * never actually re-checked or resolved. Confirmed live: all 351
 * Content Depth findings were invisible on both pages before this fix.
 *
 * The correct model: for each distinct issue (same page + category +
 * checkStep + title), the most recent non-closed finding row IS the
 * current state of that issue, regardless of which crawl created it.
 */
import { prisma } from "@/lib/db";
import type { Finding, Page } from "@prisma/client";

export type FindingWithPage = Finding & { page: Page | null };

const CLOSED_STATUSES = new Set(["COMPLETED", "ALREADY_COMPLETED", "VERIFIED", "IGNORED", "FALSE_POSITIVE", "ACCEPTED"]);

function isOpen(f: Finding): boolean {
  return !CLOSED_STATUSES.has(f.status);
}

export async function getOpenFindingsForSite(siteId: string): Promise<FindingWithPage[]> {
  const allFindings = await prisma.finding.findMany({
    where: { crawl: { siteId } },
    include: { page: true },
    orderBy: { detectedAt: "desc" },
  });

  // Keep only the most recent finding per distinct issue -- whichever
  // crawl it happened to be attached to.
  const latestByIssue = new Map<string, FindingWithPage>();
  for (const f of allFindings) {
    const key = `${f.pageId ?? "sitewide"}::${f.category}::${f.checkStep}::${f.title}`;
    if (!latestByIssue.has(key)) latestByIssue.set(key, f);
  }

  return [...latestByIssue.values()].filter(isOpen);
}
