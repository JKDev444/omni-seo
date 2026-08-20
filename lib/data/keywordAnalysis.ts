/**
 * Cannibalization, content-decay, and CTR-opportunity detection — all
 * derived from cached GscMetric rows, so these are free/deterministic
 * (unlike rank checks or keyword volume, which cost real money per call).
 */
import { prisma } from "@/lib/db";

export interface CannibalizationIssue {
  query: string;
  pages: { url: string; impressions: number; clicks: number; avgPosition: number }[];
}

/** Multiple owned URLs both getting real impressions for the same query — may be intentional segmentation, may be splitting authority. */
export async function detectCannibalization(siteId: string, minImpressions = 10): Promise<CannibalizationIssue[]> {
  const metrics = await prisma.gscMetric.findMany({
    where: { siteId, query: { not: null }, page: { not: null } },
    select: { query: true, page: true, impressions: true, clicks: true, position: true },
  });

  const byQuery = new Map<string, Map<string, { impressions: number; clicks: number; positionSum: number; count: number }>>();
  for (const m of metrics) {
    if (!m.query || !m.page) continue;
    const pages = byQuery.get(m.query) ?? new Map();
    const entry = pages.get(m.page) ?? { impressions: 0, clicks: 0, positionSum: 0, count: 0 };
    entry.impressions += m.impressions;
    entry.clicks += m.clicks;
    entry.positionSum += m.position;
    entry.count += 1;
    pages.set(m.page, entry);
    byQuery.set(m.query, pages);
  }

  const issues: CannibalizationIssue[] = [];
  for (const [query, pages] of byQuery) {
    const withImpressions = [...pages.entries()].filter(([, e]) => e.impressions >= minImpressions);
    if (withImpressions.length < 2) continue;
    issues.push({
      query,
      pages: withImpressions
        .map(([url, e]) => ({ url, impressions: e.impressions, clicks: e.clicks, avgPosition: Math.round((e.positionSum / e.count) * 10) / 10 }))
        .sort((a, b) => b.impressions - a.impressions),
    });
  }

  return issues.sort((a, b) => b.pages.reduce((s, p) => s + p.impressions, 0) - a.pages.reduce((s, p) => s + p.impressions, 0));
}

export interface ContentDecayIssue {
  page: string;
  recentImpressions: number;
  priorImpressions: number;
  recentPosition: number;
  priorPosition: number;
  impressionsChangePct: number;
}

/** Compares the most recent 28-day window against the prior 28-day window; flags pages losing visibility. */
export async function detectContentDecay(siteId: string): Promise<ContentDecayIssue[]> {
  const now = new Date();
  const recentStart = new Date(now);
  recentStart.setDate(recentStart.getDate() - 28);
  const priorStart = new Date(now);
  priorStart.setDate(priorStart.getDate() - 56);

  const [recent, prior] = await Promise.all([
    prisma.gscMetric.findMany({ where: { siteId, page: { not: null }, date: { gte: recentStart } }, select: { page: true, impressions: true, position: true } }),
    prisma.gscMetric.findMany({ where: { siteId, page: { not: null }, date: { gte: priorStart, lt: recentStart } }, select: { page: true, impressions: true, position: true } }),
  ]);

  function aggregate(rows: { page: string | null; impressions: number; position: number }[]) {
    const byPage = new Map<string, { impressions: number; positionSum: number; count: number }>();
    for (const r of rows) {
      if (!r.page) continue;
      const e = byPage.get(r.page) ?? { impressions: 0, positionSum: 0, count: 0 };
      e.impressions += r.impressions;
      e.positionSum += r.position;
      e.count += 1;
      byPage.set(r.page, e);
    }
    return byPage;
  }

  const recentByPage = aggregate(recent);
  const priorByPage = aggregate(prior);

  const issues: ContentDecayIssue[] = [];
  for (const [page, priorEntry] of priorByPage) {
    if (priorEntry.impressions < 20) continue; // ignore pages with negligible prior traffic
    const recentEntry = recentByPage.get(page) ?? { impressions: 0, positionSum: 0, count: 0 };
    const changePct = Math.round(((recentEntry.impressions - priorEntry.impressions) / priorEntry.impressions) * 1000) / 10;
    if (changePct >= -20) continue; // only flag real decay, not noise

    issues.push({
      page,
      recentImpressions: recentEntry.impressions,
      priorImpressions: priorEntry.impressions,
      recentPosition: recentEntry.count > 0 ? Math.round((recentEntry.positionSum / recentEntry.count) * 10) / 10 : 0,
      priorPosition: Math.round((priorEntry.positionSum / priorEntry.count) * 10) / 10,
      impressionsChangePct: changePct,
    });
  }

  return issues.sort((a, b) => a.impressionsChangePct - b.impressionsChangePct);
}

export interface CtrOpportunity {
  page: string;
  query: string | null;
  impressions: number;
  ctr: number;
  avgPosition: number;
  expectedCtr: number;
}

// Rough organic CTR-by-position curve (industry-standard shape, not exact) — used only to flag pages
// significantly underperforming for their position, not as a precise benchmark.
const EXPECTED_CTR_BY_POSITION: [number, number][] = [
  [1, 0.28], [2, 0.15], [3, 0.1], [4, 0.07], [5, 0.05], [6, 0.04], [7, 0.03], [8, 0.025], [9, 0.02], [10, 0.018],
];

function expectedCtrForPosition(position: number): number {
  const bucket = EXPECTED_CTR_BY_POSITION.find(([pos]) => position <= pos);
  return bucket ? bucket[1] : 0.01;
}

/** High-impression, good-position pages with CTR well below what that position should yield — title/meta rewrite candidates. */
export async function detectCtrOpportunities(siteId: string, minImpressions = 50): Promise<CtrOpportunity[]> {
  const metrics = await prisma.gscMetric.findMany({
    where: { siteId, page: { not: null } },
    select: { page: true, query: true, impressions: true, clicks: true, position: true },
  });

  const byPage = new Map<string, { impressions: number; clicks: number; positionSum: number; count: number; topQuery: string | null; topQueryImpressions: number }>();
  for (const m of metrics) {
    if (!m.page) continue;
    const e = byPage.get(m.page) ?? { impressions: 0, clicks: 0, positionSum: 0, count: 0, topQuery: null, topQueryImpressions: 0 };
    e.impressions += m.impressions;
    e.clicks += m.clicks;
    e.positionSum += m.position;
    e.count += 1;
    if (m.query && m.impressions > e.topQueryImpressions) {
      e.topQuery = m.query;
      e.topQueryImpressions = m.impressions;
    }
    byPage.set(m.page, e);
  }

  const opportunities: CtrOpportunity[] = [];
  for (const [page, e] of byPage) {
    if (e.impressions < minImpressions) continue;
    const avgPosition = e.positionSum / e.count;
    const ctr = e.clicks / e.impressions;
    const expected = expectedCtrForPosition(avgPosition);
    if (ctr >= expected * 0.6) continue; // only flag meaningful underperformance, not noise

    opportunities.push({
      page,
      query: e.topQuery,
      impressions: e.impressions,
      ctr: Math.round(ctr * 1000) / 10,
      avgPosition: Math.round(avgPosition * 10) / 10,
      expectedCtr: Math.round(expected * 1000) / 10,
    });
  }

  return opportunities.sort((a, b) => b.impressions - a.impressions);
}
