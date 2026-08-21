import { PageType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { reviewAiSearchReadiness } from "./anthropicAiSearchReadiness";
import { extractVisibleText } from "@/lib/checks/contentDepthChecks";
import { runAiSearchReadinessChecks } from "@/lib/checks/aiSearchReadinessChecks";
import { createFindingRecord } from "@/lib/findings/createFinding";
import { ReconciliationTracker } from "@/lib/findings/autoResolveFixedFindings";

// Same reviewable set as Content Depth (Phase H) -- utility pages aren't
// worth the per-page LLM cost here either.
const REVIEWABLE_TYPES: PageType[] = [
  PageType.SERVICE_PAGE,
  PageType.PRODUCT_PAGE,
  PageType.BLOG_ARTICLE,
  PageType.HOMEPAGE,
  PageType.ABOUT_PAGE,
];
const DEFAULT_MAX_PAGES = 20;

export async function pullAiSearchReadiness(
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

  // Same reasoning as Content Depth's reconciliation: a page reclassified
  // out of REVIEWABLE_TYPES can never re-earn a fresh review, so any
  // stale finding from when it WAS reviewed needs resolving explicitly.
  const allPages = await prisma.page.findMany({ where: { siteId }, select: { id: true, pageType: true } });
  for (const p of allPages) {
    if (!REVIEWABLE_TYPES.includes(p.pageType)) {
      tracker.markEvaluated(p.id, "AI Search Readiness");
    }
  }

  for (const snap of snapshots) {
    const existing = await prisma.aiSearchReadiness.findUnique({ where: { siteId_url: { siteId, url: snap.page.url } } });
    if (existing && existing.contentHash === snap.rawHtmlHash) {
      skippedUnchanged++;
      continue;
    }

    const visibleText = extractVisibleText(snap.rawHtml);
    const result = await reviewAiSearchReadiness(snap.page.url, snap.page.pageType, snap.page.h1, visibleText);

    if (!result.ok) {
      if (result.reason === "missing_api_key") {
        return { ok: false, analyzed, skippedUnchanged, errors, errorDetails, findingsCreated, message: result.message };
      }
      errors++;
      errorDetails.push({ url: snap.page.url, reason: result.reason, message: result.message });
      continue;
    }

    const s = result.scores;
    await prisma.aiSearchReadiness.upsert({
      where: { siteId_url: { siteId, url: snap.page.url } },
      update: {
        contentHash: snap.rawHtmlHash,
        entityClarityScore: s.entityClarity.score,
        citationReadinessScore: s.citationReadiness.score,
        extractabilityScore: s.extractability.score,
        hasAnswerBlock: s.hasAnswerBlock,
        issues: JSON.parse(JSON.stringify(s)),
        fetchedAt: new Date(),
      },
      create: {
        siteId,
        pageId: snap.pageId,
        url: snap.page.url,
        contentHash: snap.rawHtmlHash,
        entityClarityScore: s.entityClarity.score,
        citationReadinessScore: s.citationReadiness.score,
        extractabilityScore: s.extractability.score,
        hasAnswerBlock: s.hasAnswerBlock,
        issues: JSON.parse(JSON.stringify(s)),
      },
    });
    analyzed++;
    tracker.markEvaluated(snap.pageId, "AI Search Readiness");

    for (const finding of runAiSearchReadinessChecks(s)) {
      await createFindingRecord(latestCrawl.id, snap.pageId, finding);
      tracker.markCreated({ pageId: snap.pageId, category: finding.category, checkStep: finding.checkStep, title: finding.title });
      findingsCreated++;
    }
  }

  await tracker.resolveFixedFindings(siteId);

  return { ok: true, analyzed, skippedUnchanged, errors, errorDetails, findingsCreated };
}
