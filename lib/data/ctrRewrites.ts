import { prisma } from "@/lib/db";
import { detectCtrOpportunities } from "@/lib/data/keywordAnalysis";
import { generateCtrRewrite } from "@/lib/integrations/ctrRewriteSuggestions";

export interface CtrRewriteRunResult {
  ok: boolean;
  generated: number;
  skippedExisting: number;
  errors: number;
  errorDetails: { url: string; message: string }[];
  message?: string;
}

/** Generates (and caches) title/meta rewrite suggestions for CTR-opportunity pages that don't have one yet. */
export async function pullCtrRewriteSuggestions(siteId: string, maxPages = 20): Promise<CtrRewriteRunResult> {
  const opportunities = await detectCtrOpportunities(siteId);
  if (opportunities.length === 0) {
    return { ok: true, generated: 0, skippedExisting: 0, errors: 0, errorDetails: [], message: "No CTR opportunities found." };
  }

  let generated = 0;
  let skippedExisting = 0;
  let errors = 0;
  const errorDetails: { url: string; message: string }[] = [];

  for (const opp of opportunities.slice(0, maxPages)) {
    const existing = await prisma.ctrRewriteSuggestion.findUnique({ where: { siteId_url: { siteId, url: opp.page } } });
    if (existing) {
      skippedExisting++;
      continue;
    }

    const page = await prisma.page.findUnique({ where: { siteId_url: { siteId, url: opp.page } } });
    if (!page) {
      errors++;
      errorDetails.push({ url: opp.page, message: "No crawled Page record found for this URL." });
      continue;
    }

    const result = await generateCtrRewrite(
      opp.page,
      opp.query ?? "(unknown query)",
      page.title,
      page.metaDesc,
      opp.ctr,
      opp.avgPosition,
      opp.impressions
    );

    if (!result.ok) {
      if (result.reason === "missing_api_key") {
        return { ok: false, generated, skippedExisting, errors, errorDetails, message: result.message };
      }
      errors++;
      errorDetails.push({ url: opp.page, message: result.message });
      continue;
    }

    await prisma.ctrRewriteSuggestion.create({
      data: {
        siteId,
        pageId: page.id,
        url: opp.page,
        query: opp.query ?? "(unknown query)",
        impressions: opp.impressions,
        ctr: opp.ctr,
        avgPosition: opp.avgPosition,
        currentTitle: page.title,
        currentMetaDesc: page.metaDesc,
        suggestedTitle: result.result.suggestedTitle,
        suggestedMetaDesc: result.result.suggestedMetaDesc,
        rationale: result.result.rationale,
      },
    });
    generated++;
  }

  return { ok: true, generated, skippedExisting, errors, errorDetails };
}
