import { prisma } from "@/lib/db";
import { V1_DOMAIN } from "@/lib/data/dashboard";
import { detectCannibalization, detectContentDecay, detectCtrOpportunities, type CannibalizationIssue, type ContentDecayIssue, type CtrOpportunity } from "@/lib/data/keywordAnalysis";

export interface CtrRewriteRow {
  url: string;
  query: string;
  impressions: number;
  ctr: number;
  avgPosition: number;
  currentTitle: string | null;
  currentMetaDesc: string | null;
  suggestedTitle: string;
  suggestedMetaDesc: string;
  rationale: string;
}

export interface KeywordRow {
  id: string;
  phrase: string;
  targetUrl: string | null;
  searchVolume: number | null;
  latestPosition: number | null;
  previousPosition: number | null;
  localPack: boolean;
  aiOverview: boolean;
  lastCheckedAt: Date | null;
}

export interface KeywordsPageData {
  site: { id: string } | null;
  keywords: KeywordRow[];
  cannibalization: CannibalizationIssue[];
  decay: ContentDecayIssue[];
  ctrOpportunities: CtrOpportunity[];
  ctrRewrites: CtrRewriteRow[];
}

export async function getKeywordsPageData(): Promise<KeywordsPageData> {
  const site = await prisma.site.findUnique({ where: { domain: V1_DOMAIN } });
  if (!site) return { site: null, keywords: [], cannibalization: [], decay: [], ctrOpportunities: [], ctrRewrites: [] };

  const keywords = await prisma.keyword.findMany({
    where: { siteId: site.id, active: true },
    include: { rankings: { orderBy: { checkedAt: "desc" }, take: 2 } },
    orderBy: { phrase: "asc" },
  });

  const [cannibalization, decay, ctrOpportunities, ctrRewrites] = await Promise.all([
    detectCannibalization(site.id),
    detectContentDecay(site.id),
    detectCtrOpportunities(site.id),
    prisma.ctrRewriteSuggestion.findMany({ where: { siteId: site.id }, orderBy: { impressions: "desc" } }),
  ]);

  return {
    site: { id: site.id },
    keywords: keywords.map((k) => ({
      id: k.id,
      phrase: k.phrase,
      targetUrl: k.targetUrl,
      searchVolume: k.searchVolume,
      latestPosition: k.rankings[0]?.position ?? null,
      previousPosition: k.rankings[1]?.position ?? null,
      localPack: k.rankings[0]?.localPack ?? false,
      aiOverview: k.rankings[0]?.aiOverview ?? false,
      lastCheckedAt: k.rankings[0]?.checkedAt ?? null,
    })),
    cannibalization,
    decay,
    ctrOpportunities,
    ctrRewrites: ctrRewrites.map((r) => ({
      url: r.url,
      query: r.query,
      impressions: r.impressions,
      ctr: r.ctr,
      avgPosition: r.avgPosition,
      currentTitle: r.currentTitle,
      currentMetaDesc: r.currentMetaDesc,
      suggestedTitle: r.suggestedTitle,
      suggestedMetaDesc: r.suggestedMetaDesc,
      rationale: r.rationale,
    })),
  };
}
