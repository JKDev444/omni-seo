/**
 * Suggests starter keywords from cached GSC data (queries with real
 * impressions the site already shows for) that aren't tracked as a
 * Keyword yet. Grounds the initial rank-tracking list in queries we
 * know Google already associates with the site, rather than guessing.
 */
import { prisma } from "@/lib/db";

export interface KeywordSuggestion {
  phrase: string;
  targetUrl: string | null;
  impressions: number;
  clicks: number;
  avgPosition: number;
}

export async function suggestKeywordsFromGsc(siteId: string, limit = 25): Promise<KeywordSuggestion[]> {
  const metrics = await prisma.gscMetric.findMany({
    where: { siteId, query: { not: null } },
    select: { query: true, page: true, impressions: true, clicks: true, position: true },
  });

  const byQuery = new Map<string, { impressions: number; clicks: number; positionSum: number; count: number; pages: Map<string, number> }>();

  for (const m of metrics) {
    if (!m.query) continue;
    const entry = byQuery.get(m.query) ?? { impressions: 0, clicks: 0, positionSum: 0, count: 0, pages: new Map<string, number>() };
    entry.impressions += m.impressions;
    entry.clicks += m.clicks;
    entry.positionSum += m.position;
    entry.count += 1;
    if (m.page) entry.pages.set(m.page, (entry.pages.get(m.page) ?? 0) + m.impressions);
    byQuery.set(m.query, entry);
  }

  const existing = new Set((await prisma.keyword.findMany({ where: { siteId }, select: { phrase: true } })).map((k) => k.phrase.toLowerCase()));

  const suggestions: KeywordSuggestion[] = [];
  for (const [phrase, entry] of byQuery) {
    if (existing.has(phrase.toLowerCase())) continue;
    const topPage = [...entry.pages.entries()].sort((a, b) => b[1] - a[1])[0];
    suggestions.push({
      phrase,
      targetUrl: topPage ? topPage[0] : null,
      impressions: entry.impressions,
      clicks: entry.clicks,
      avgPosition: Math.round((entry.positionSum / entry.count) * 10) / 10,
    });
  }

  return suggestions.sort((a, b) => b.impressions - a.impressions).slice(0, limit);
}
