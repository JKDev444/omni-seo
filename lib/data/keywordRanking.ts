/**
 * Runs live SERP rank checks for a site's active tracked keywords via
 * DataForSEO. Each check is a real per-keyword cost, so this is a
 * separate, deliberately-triggered pull (cron/manual script), not part
 * of every crawl — same cost-awareness pattern as the LLM content review.
 */
import { prisma } from "@/lib/db";
import { checkKeywordRank, fetchKeywordVolume } from "@/lib/integrations/dataforseo";

// Tumwater, WA (confirmed against a live DataForSEO /v3/serp/google/locations
// response — the clinic's actual city). Overridable per-site via
// Site.dataForSeoLocationCode.
const DEFAULT_LOCATION_CODE = 1027784;

export interface KeywordRankingRunResult {
  ok: boolean;
  checked: number;
  errors: number;
  errorDetails: { phrase: string; message: string }[];
  message?: string;
}

export async function runKeywordRankings(siteId: string): Promise<KeywordRankingRunResult> {
  const site = await prisma.site.findUniqueOrThrow({ where: { id: siteId } });
  const locationCode = site.dataForSeoLocationCode ?? DEFAULT_LOCATION_CODE;
  const languageCode = site.dataForSeoLanguageCode ?? "en";

  const keywords = await prisma.keyword.findMany({ where: { siteId, active: true } });
  if (keywords.length === 0) {
    return { ok: true, checked: 0, errors: 0, errorDetails: [], message: "No active keywords to check." };
  }

  let checked = 0;
  let errors = 0;
  const errorDetails: { phrase: string; message: string }[] = [];

  for (const kw of keywords) {
    const result = await checkKeywordRank(kw.phrase, site.domain, locationCode, languageCode);

    if (!result.ok) {
      if (result.reason === "missing_credentials") {
        return { ok: false, checked, errors, errorDetails, message: result.message };
      }
      errors++;
      errorDetails.push({ phrase: kw.phrase, message: result.message });
      continue;
    }

    await prisma.keywordRanking.create({
      data: {
        keywordId: kw.id,
        position: result.data.position,
        rankingUrl: result.data.rankingUrl,
        localPack: result.data.localPack,
        aiOverview: result.data.aiOverview,
        serpFeatures: result.data.serpFeatures,
      },
    });
    checked++;
  }

  return { ok: true, checked, errors, errorDetails };
}

/** Backfills search volume/CPC for keywords that don't have it yet (one-time per keyword, not repeated). */
export async function backfillKeywordVolume(siteId: string): Promise<{ ok: boolean; updated: number; message?: string }> {
  const site = await prisma.site.findUniqueOrThrow({ where: { id: siteId } });
  const locationCode = site.dataForSeoLocationCode ?? DEFAULT_LOCATION_CODE;
  const languageCode = site.dataForSeoLanguageCode ?? "en";

  const keywords = await prisma.keyword.findMany({ where: { siteId, active: true, searchVolume: null } });
  if (keywords.length === 0) return { ok: true, updated: 0, message: "No keywords missing volume data." };

  const result = await fetchKeywordVolume(keywords.map((k) => k.phrase), locationCode, languageCode);
  if (!result.ok) return { ok: false, updated: 0, message: result.message };

  const byPhrase = new Map(result.data.map((r) => [r.keyword.toLowerCase(), r]));
  let updated = 0;
  for (const kw of keywords) {
    const data = byPhrase.get(kw.phrase.toLowerCase());
    if (!data) continue;
    await prisma.keyword.update({
      where: { id: kw.id },
      data: { searchVolume: data.searchVolume, cpc: data.cpc },
    });
    updated++;
  }

  return { ok: true, updated };
}
