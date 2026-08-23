import { prisma } from "@/lib/db";
import { getActiveSite } from "@/lib/data/activeSite";
import { detectCannibalization, detectContentDecay, detectCtrOpportunities, type CannibalizationIssue, type ContentDecayIssue, type CtrOpportunity } from "@/lib/data/keywordAnalysis";
import type { KeywordIdeaRecommendation } from "@prisma/client";

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

export interface KeywordIdeaRow {
  id: string;
  phrase: string;
  searchVolume: number | null;
  difficulty: number | null;
  competitionLevel: string | null;
  intent: string | null;
  recommendation: KeywordIdeaRecommendation;
  rationale: string;
}

export interface KeywordsPageData {
  site: { id: string } | null;
  keywords: KeywordRow[];
  ideas: KeywordIdeaRow[];
  cannibalization: CannibalizationIssue[];
  decay: ContentDecayIssue[];
  ctrOpportunities: CtrOpportunity[];
  ctrRewrites: CtrRewriteRow[];
}

const RECOMMENDATION_ORDER: Record<KeywordIdeaRecommendation, number> = { PURSUE: 0, CONSIDER: 1, SKIP: 2 };

export async function getKeywordsPageData(): Promise<KeywordsPageData> {
  const site = await getActiveSite();
  if (!site) return { site: null, keywords: [], ideas: [], cannibalization: [], decay: [], ctrOpportunities: [], ctrRewrites: [] };

  const keywords = await prisma.keyword.findMany({
    where: { siteId: site.id, active: true },
    include: { rankings: { orderBy: { checkedAt: "desc" }, take: 2 } },
    orderBy: { phrase: "asc" },
  });

  const [cannibalization, decay, ctrOpportunities, ctrRewrites, ideas] = await Promise.all([
    detectCannibalization(site.id),
    detectContentDecay(site.id),
    detectCtrOpportunities(site.id),
    prisma.ctrRewriteSuggestion.findMany({ where: { siteId: site.id }, orderBy: { impressions: "desc" } }),
    prisma.keywordIdea.findMany({ where: { siteId: site.id, dismissed: false, trackedAsKeywordId: null } }),
  ]);

  return {
    site: { id: site.id },
    ideas: ideas
      .sort((a, b) => RECOMMENDATION_ORDER[a.recommendation] - RECOMMENDATION_ORDER[b.recommendation] || (b.searchVolume ?? 0) - (a.searchVolume ?? 0))
      .map((i) => ({
        id: i.id,
        phrase: i.phrase,
        searchVolume: i.searchVolume,
        difficulty: i.difficulty,
        competitionLevel: i.competitionLevel,
        intent: i.intent,
        recommendation: i.recommendation,
        rationale: i.rationale,
      })),
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
