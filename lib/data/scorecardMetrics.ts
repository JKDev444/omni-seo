/**
 * Phase Q: real, computed Scorecard values — replaces the 5 fabricated
 * sample numbers the original seed script wrote (58/74/90, invented for
 * demo purposes, never touched since). Every metric here is computed
 * from data this app already collects live, not estimated.
 */
import { prisma } from "@/lib/db";
import { getDashboardData } from "@/lib/data/dashboard";

export interface ComputedMetric {
  metric: string;
  current: number;
  target: number;
  source: string;
}

export async function computeRealScorecardMetrics(siteId: string): Promise<ComputedMetric[]> {
  const metrics: ComputedMetric[] = [];

  // Technical SEO score -- reuses the exact same scoring the Dashboard's
  // health rings use, so the two can never disagree on the same number
  // (the content-stack scoring mismatch earlier this session is exactly
  // the bug this avoids repeating).
  const dashboard = await getDashboardData();
  const technicalRing = dashboard.rings.find((r) => r.label === "Technical");
  if (technicalRing) {
    metrics.push({ metric: "Technical SEO score", current: technicalRing.score, target: 90, source: "crawler" });
  }

  // Indexed pages -- real count from the URL Inspection API's last run.
  const indexedCount = await prisma.urlInspection.count({ where: { siteId, normalizedStatus: "Indexed" } });
  if (indexedCount > 0) {
    metrics.push({ metric: "Indexed pages (GSC)", current: indexedCount, target: Math.ceil(indexedCount * 1.15), source: "GSC" });
  }

  // Avg. position for branded queries -- "omni" matches the business
  // name (Omni Centers) across query variants (omni centers, omni
  // center olympia, omnicenters, etc.) in real GSC query data.
  const brandedQueries = await prisma.gscMetric.findMany({
    where: { siteId, query: { contains: "omni", mode: "insensitive" } },
    select: { position: true, impressions: true },
  });
  if (brandedQueries.length > 0) {
    const weightedSum = brandedQueries.reduce((sum, q) => sum + q.position * q.impressions, 0);
    const totalImpressions = brandedQueries.reduce((sum, q) => sum + q.impressions, 0);
    const avgBrandedPosition = totalImpressions > 0 ? weightedSum / totalImpressions : null;
    if (avgBrandedPosition !== null) {
      metrics.push({ metric: "Avg. position (branded)", current: Math.round(avgBrandedPosition * 10) / 10, target: 1.5, source: "GSC" });
    }
  }

  // Organic sessions/mo -- real GA4 sessions, Organic Search channel, last 30 days.
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const organicSessions = await prisma.ga4Metric.aggregate({
    where: { siteId, channelGroup: "Organic Search", date: { gte: thirtyDaysAgo } },
    _sum: { sessions: true },
  });
  if (organicSessions._sum.sessions !== null) {
    metrics.push({
      metric: "Organic sessions / mo",
      current: organicSessions._sum.sessions,
      target: Math.ceil(organicSessions._sum.sessions * 1.5),
      source: "GA4",
    });
  }

  // Local pack visibility -- % of actively-tracked keywords whose most
  // recent rank check showed us in the local 3-pack.
  const keywords = await prisma.keyword.findMany({
    where: { siteId, active: true },
    include: { rankings: { orderBy: { checkedAt: "desc" }, take: 1 } },
  });
  const keywordsWithRankData = keywords.filter((k) => k.rankings.length > 0);
  if (keywordsWithRankData.length > 0) {
    const inLocalPack = keywordsWithRankData.filter((k) => k.rankings[0].localPack).length;
    const localPackPct = Math.round((inLocalPack / keywordsWithRankData.length) * 100);
    metrics.push({ metric: "Local pack visibility", current: localPackPct, target: 65, source: "manual" });
  }

  return metrics;
}
