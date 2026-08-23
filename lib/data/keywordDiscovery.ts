/**
 * Keyword discovery ("keyword planner"): surfaces real keyword ideas the
 * site doesn't already track, via DataForSEO Labs' keyword_ideas endpoint
 * (lib/integrations/dataforseo.ts), seeded from real service-page titles/
 * H1s plus already-tracked phrases. Separate concern from lib/data/
 * keywordRanking.ts, which only rank-checks keywords already added.
 *
 * Recommendation (PURSUE/CONSIDER/SKIP) is a deterministic score, not an
 * LLM guess -- same ICE-style expected-value shape as
 * lib/data/roadmapPlan.ts's computeIceScore: volume (impact) divided by
 * a difficulty tier (effort), so the reasoning is inspectable and
 * reproducible instead of a black box.
 */
import { prisma } from "@/lib/db";
import { KeywordIdeaRecommendation } from "@prisma/client";
import { fetchKeywordIdeas } from "@/lib/integrations/dataforseo";

const LABS_LOCATION_CODE = 2840; // United States -- DataForSEO Labs' keyword
// database is only granular to the country level (confirmed by querying
// /dataforseo_labs/locations_and_languages directly: no state/city entries
// exist for the US, only country rows). City-level codes used elsewhere in
// this app (e.g. Tumwater, WA, for SERP rank checks) are rejected here.
// Every volume number from this endpoint is therefore a NATIONAL number,
// not local demand -- see isLocallyQualified below for how that's handled.
const MAX_SEEDS = 15;
const MAX_IDEAS_PER_RUN = 100;

// Specific to omnicenters.com's real service area (Tumwater/Olympia/Lacey,
// WA) -- same fixed-list approach already used for the backlinks competitor
// set (see README's Known limitations). Revisit per-site once a second
// site with a different service area is onboarded.
const LOCAL_QUALIFIER_PATTERN = /\b(near me|tumwater|olympia|lacey|washington|\bwa\b)\b/i;

function isLocallyQualified(phrase: string): boolean {
  return LOCAL_QUALIFIER_PATTERN.test(phrase);
}

type DifficultyTier = "low" | "medium" | "high";

function difficultyTier(difficulty: number | null, competitionLevel: string | null): DifficultyTier {
  if (difficulty !== null) {
    if (difficulty <= 30) return "low";
    if (difficulty <= 60) return "medium";
    return "high";
  }
  if (competitionLevel === "LOW") return "low";
  if (competitionLevel === "HIGH") return "high";
  return "medium";
}

const EFFORT_WEIGHT: Record<DifficultyTier, number> = { low: 1, medium: 2, high: 4 };
const NATIONAL_HEAD_TERM_VOLUME = 3000; // above this, a bare national number stops being a useful proxy for one location's reachable demand

export interface Opportunity {
  score: number;
  tier: DifficultyTier;
  recommendation: KeywordIdeaRecommendation;
  rationale: string;
}

/**
 * PURSUE/CONSIDER/SKIP, deterministic (no LLM), same ICE-style
 * volume-over-effort shape as lib/data/roadmapPlan.ts's computeIceScore --
 * but weighted down for generic national terms, since this site is a
 * single-location clinic and DataForSEO Labs can only return national
 * volume (see LABS_LOCATION_CODE above). A locally-qualified phrase
 * ("laser hair removal Tumwater", "med spa near me") is almost entirely
 * searched by people in-market, so its national number is a reasonable
 * proxy. A bare generic term ("hair removal") is searched everywhere, so
 * a single location's realistic, reachable share of it is a small
 * fraction of the raw number -- that's reflected here as a lower ceiling
 * on the recommendation, not a lower score (the score is still shown so
 * the real math is visible).
 */
export function computeOpportunity(
  phrase: string,
  searchVolume: number | null,
  difficulty: number | null,
  competitionLevel: string | null
): Opportunity {
  const volume = searchVolume ?? 0;
  const tier = difficultyTier(difficulty, competitionLevel);
  const score = Math.round((volume / EFFORT_WEIGHT[tier]) * 10) / 10;
  const difficultyLabel = difficulty !== null ? `difficulty ${difficulty}/100` : `${competitionLevel ?? "unknown"} competition`;
  const local = isLocallyQualified(phrase);

  if (volume < 10) {
    return { score, tier, recommendation: KeywordIdeaRecommendation.SKIP, rationale: `Only ~${volume} monthly searches nationally — too little to be worth targeting regardless of difficulty.` };
  }

  if (local) {
    if (tier === "high" && volume < 50) {
      return { score, tier, recommendation: KeywordIdeaRecommendation.SKIP, rationale: `Location-qualified but ${difficultyLabel} and only ~${volume}/mo nationally — not enough upside for the effort.` };
    }
    if (tier === "high") {
      return { score, tier, recommendation: KeywordIdeaRecommendation.CONSIDER, rationale: `Location-qualified (~${volume}/mo nationally) but ${difficultyLabel} — worth it only with real content investment.` };
    }
    return { score, tier, recommendation: KeywordIdeaRecommendation.PURSUE, rationale: `Names your actual service area — this national volume (~${volume}/mo) is almost entirely in-market searchers, and ${difficultyLabel} makes it realistic to rank for.` };
  }

  // Generic/national term -- no location qualifier, so the volume above is
  // not a reliable stand-in for what one clinic in one metro could capture.
  if (tier === "high") {
    return { score, tier, recommendation: KeywordIdeaRecommendation.SKIP, rationale: `Generic national term at ${difficultyLabel} — unrealistic to rank for as a single-location business.` };
  }
  if (volume > NATIONAL_HEAD_TERM_VOLUME) {
    return { score, tier, recommendation: KeywordIdeaRecommendation.CONSIDER, rationale: `~${volume}/mo nationally, but that's a broad head term with no location qualifier — real reachable local demand is a fraction of that number. Treat as a content/authority topic, not an expected quick local win.` };
  }
  if (tier === "low") {
    return { score, tier, recommendation: KeywordIdeaRecommendation.PURSUE, rationale: `Modest, realistic volume (~${volume}/mo) at low competition (${difficultyLabel}) — plausible to rank for even without a location qualifier.` };
  }
  return { score, tier, recommendation: KeywordIdeaRecommendation.CONSIDER, rationale: `~${volume}/mo nationally at ${difficultyLabel} — worth a look, not an obvious priority.` };
}

export interface DiscoveryRunResult {
  ok: boolean;
  seedsUsed: string[];
  fetched: number;
  saved: number;
  message?: string;
}

/** Gathers real seed terms: service-page titles/H1s plus already-tracked keyword phrases. */
async function gatherSeeds(siteId: string): Promise<string[]> {
  const [pages, keywords] = await Promise.all([
    prisma.page.findMany({
      where: { siteId, pageType: "SERVICE_PAGE" },
      select: { title: true, h1: true },
    }),
    prisma.keyword.findMany({ where: { siteId, active: true }, select: { phrase: true } }),
  ]);

  const seeds = new Set<string>();
  for (const p of pages) {
    // Titles are often "Service Name | Brand" -- strip the brand suffix so the
    // seed is the actual service term, not diluted by the business name.
    const cleaned = (p.h1 ?? p.title ?? "").split(/[|\-–—]/)[0].trim();
    if (cleaned.length >= 3 && cleaned.length <= 80) seeds.add(cleaned);
  }
  for (const k of keywords) seeds.add(k.phrase);

  return [...seeds].slice(0, MAX_SEEDS);
}

export async function runKeywordDiscovery(siteId: string): Promise<DiscoveryRunResult> {
  const site = await prisma.site.findUniqueOrThrow({ where: { id: siteId } });
  const seeds = await gatherSeeds(siteId);

  if (seeds.length === 0) {
    return { ok: false, seedsUsed: [], fetched: 0, saved: 0, message: "No service pages or tracked keywords to seed discovery from yet — run a crawl first." };
  }

  const result = await fetchKeywordIdeas(seeds, LABS_LOCATION_CODE, site.dataForSeoLanguageCode ?? "en", MAX_IDEAS_PER_RUN);
  if (!result.ok) {
    return { ok: false, seedsUsed: seeds, fetched: 0, saved: 0, message: result.message };
  }

  const existingTracked = new Set(
    (await prisma.keyword.findMany({ where: { siteId }, select: { phrase: true } })).map((k) => k.phrase.toLowerCase())
  );

  let saved = 0;
  for (const idea of result.data) {
    const phrase = idea.keyword.trim();
    if (!phrase || existingTracked.has(phrase.toLowerCase())) continue;

    const opportunity = computeOpportunity(phrase, idea.searchVolume, idea.difficulty, idea.competitionLevel);

    await prisma.keywordIdea.upsert({
      where: { siteId_phrase: { siteId, phrase } },
      create: {
        siteId,
        phrase,
        searchVolume: idea.searchVolume,
        cpc: idea.cpc,
        competition: idea.competition,
        competitionLevel: idea.competitionLevel,
        difficulty: idea.difficulty,
        intent: idea.intent,
        recommendation: opportunity.recommendation,
        rationale: opportunity.rationale,
      },
      update: {
        searchVolume: idea.searchVolume,
        cpc: idea.cpc,
        competition: idea.competition,
        competitionLevel: idea.competitionLevel,
        difficulty: idea.difficulty,
        intent: idea.intent,
        recommendation: opportunity.recommendation,
        rationale: opportunity.rationale,
      },
    });
    saved++;
  }

  return { ok: true, seedsUsed: seeds, fetched: result.data.length, saved };
}
