import { prisma } from "@/lib/db";
import type { RawFinding } from "@/lib/checks/onPageChecks";
import type { FindingStatus } from "@prisma/client";

// Every crawl creates fresh Finding rows rather than updating existing
// ones (needed so a genuinely-still-broken issue reappears rather than
// staying silently marked done forever). Without this, a human's
// "Ignore" or "False positive" call on one crawl's finding would vanish
// the moment the next crawl ran and recreated the same issue as PENDING
// -- discovered live: 6 rows existed for one orphan-page finding across
// today's crawls, and none of the status decisions carried between them.
// COMPLETED is deliberately excluded -- if the check still detects the
// issue, silently marking the new row "done" would hide a real
// regression instead of surfacing it.
const CARRY_FORWARD_STATUSES: FindingStatus[] = ["IGNORED", "FALSE_POSITIVE", "ACCEPTED"];

async function findCarriedForwardStatus(crawlId: string, pageId: string | null, category: string, title: string): Promise<FindingStatus | null> {
  const crawl = await prisma.crawl.findUnique({ where: { id: crawlId }, select: { siteId: true } });
  if (!crawl) return null;

  const prior = await prisma.finding.findFirst({
    where: {
      pageId,
      category,
      title,
      status: { in: CARRY_FORWARD_STATUSES },
      crawl: { siteId: crawl.siteId, id: { not: crawlId } },
    },
    orderBy: { detectedAt: "desc" },
    select: { status: true },
  });

  return prior?.status ?? null;
}

/** Shared by the crawler and any other process that produces findings against a crawl. */
export async function createFindingRecord(crawlId: string, pageId: string | null, f: RawFinding) {
  const carriedStatus = await findCarriedForwardStatus(crawlId, pageId, f.category, f.title);

  await prisma.finding.create({
    data: {
      crawlId,
      pageId,
      category: f.category,
      checkStep: f.checkStep,
      title: f.title,
      description: f.description,
      fixType: f.fixType,
      howToTest: f.howToTest,
      priority: f.priority,
      owner: f.owner,
      confidence: f.confidence ?? 100,
      fixLocation: f.fixLocation,
      source: f.source ?? "RAW_HTML",
      status: carriedStatus ?? "PENDING",
    },
  });
}
