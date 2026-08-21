import { PageType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { reviewPageContent } from "./anthropicContentReview";
import { extractVisibleText, runContentDepthChecks } from "@/lib/checks/contentDepthChecks";
import { createFindingRecord } from "@/lib/findings/createFinding";
import { ReconciliationTracker } from "@/lib/findings/autoResolveFixedFindings";

// Content-heavy page types worth the per-page LLM cost; utility pages
// (contact, search, collection listings) aren't worth reviewing this way.
const REVIEWABLE_TYPES: PageType[] = [
  PageType.SERVICE_PAGE,
  PageType.PRODUCT_PAGE,
  PageType.BLOG_ARTICLE,
  PageType.HOMEPAGE,
  PageType.ABOUT_PAGE,
];
const DEFAULT_MAX_PAGES = 20;

export async function pullContentAnalysis(
  siteId: string,
  maxPages = DEFAULT_MAX_PAGES
): Promise<{
  ok: boolean;
  analyzed: number;
  skippedUnchanged: number;
  errors: number;
  errorDetails: { url: string; reason: string; message: string }[];
  findingsCreated: number;
  message?: string;
}> {
  const latestCrawl = await prisma.crawl.findFirst({ where: { siteId, status: "completed" }, orderBy: { startedAt: "desc" } });
  if (!latestCrawl) return { ok: true, analyzed: 0, skippedUnchanged: 0, errors: 0, errorDetails: [], findingsCreated: 0, message: "No completed crawl yet." };

  const snapshots = await prisma.pageSnapshot.findMany({
    where: { crawlId: latestCrawl.id, page: { pageType: { in: REVIEWABLE_TYPES } } },
    include: { page: true },
    take: maxPages,
  });

  let analyzed = 0;
  let skippedUnchanged = 0;
  let errors = 0;
  let findingsCreated = 0;
  const errorDetails: { url: string; reason: string; message: string }[] = [];
  const tracker = new ReconciliationTracker();

  // A page that no longer qualifies as reviewable (e.g. reclassified from
  // service_page to utility_page after a crawl fix) can never re-earn a
  // fresh review under the current logic -- it's simply excluded from the
  // query above. Without this, a stale finding from when it WAS reviewed
  // would sit open forever. This costs no LLM calls, so it runs for every
  // page on the site, not just the cost-capped batch below.
  const allPages = await prisma.page.findMany({ where: { siteId }, select: { id: true, pageType: true } });
  for (const p of allPages) {
    if (!REVIEWABLE_TYPES.includes(p.pageType)) {
      tracker.markEvaluated(p.id, "Content Depth - LLM Review");
    }
  }

  for (const snap of snapshots) {
    const existing = await prisma.contentAnalysis.findUnique({ where: { siteId_url: { siteId, url: snap.page.url } } });
    if (existing && existing.contentHash === snap.rawHtmlHash) {
      skippedUnchanged++;
      continue;
    }

    const visibleText = extractVisibleText(snap.rawHtml);
    const result = await reviewPageContent(snap.page.url, snap.page.pageType, snap.page.h1, visibleText);

    if (!result.ok) {
      if (result.reason === "missing_api_key") {
        return { ok: false, analyzed, skippedUnchanged, errors, errorDetails, findingsCreated, message: result.message };
      }
      errors++;
      errorDetails.push({ url: snap.page.url, reason: result.reason, message: result.message });
      continue;
    }

    const s = result.scores;
    await prisma.contentAnalysis.upsert({
      where: { siteId_url: { siteId, url: snap.page.url } },
      update: {
        contentHash: snap.rawHtmlHash,
        headingIntentScore: s.headingIntent.score,
        introQualityScore: s.introQuality.score,
        entityCoverageScore: s.entityCoverage.score,
        trustSignalsScore: s.trustSignals.score,
        freshnessScore: s.freshness.score,
        ctaConsistencyScore: s.ctaConsistency.score,
        issues: JSON.parse(JSON.stringify(s)),
        fetchedAt: new Date(),
      },
      create: {
        siteId,
        pageId: snap.pageId,
        url: snap.page.url,
        contentHash: snap.rawHtmlHash,
        headingIntentScore: s.headingIntent.score,
        introQualityScore: s.introQuality.score,
        entityCoverageScore: s.entityCoverage.score,
        trustSignalsScore: s.trustSignals.score,
        freshnessScore: s.freshness.score,
        ctaConsistencyScore: s.ctaConsistency.score,
        issues: JSON.parse(JSON.stringify(s)),
      },
    });
    analyzed++;
    tracker.markEvaluated(snap.pageId, "Content Depth - LLM Review");

    for (const finding of runContentDepthChecks(s)) {
      await createFindingRecord(latestCrawl.id, snap.pageId, finding);
      tracker.markCreated({ pageId: snap.pageId, category: finding.category, checkStep: finding.checkStep, title: finding.title });
      findingsCreated++;
    }
  }

  await tracker.resolveFixedFindings(siteId);

  return { ok: true, analyzed, skippedUnchanged, errors, errorDetails, findingsCreated };
}
