import { prisma } from "@/lib/db";
import { getActiveSite } from "@/lib/data/activeSite";

export interface AnalyticsData {
  site: { id: string; gscSiteUrl: string | null; ga4PropertyId: string | null } | null;
  gscConnected: boolean;
  ga4Connected: boolean;
  gscLastFetched: Date | null;
  ga4LastFetched: Date | null;
  trend: { date: string; clicks: number; impressions: number; sessions: number; users: number }[];
  totals: { clicks: number; impressions: number; ctr: number; avgPosition: number; sessions: number; users: number; conversions: number };
  topQueries: { query: string; clicks: number; impressions: number; ctr: number; position: number }[];
  topPages: { page: string; sessions: number; clicks: number }[];
  channelBreakdown: { channel: string; sessions: number }[];
  deviceBreakdown: { device: string; sessions: number }[];
}

function emptyAnalytics(site: AnalyticsData["site"]): AnalyticsData {
  return {
    site,
    gscConnected: !!site?.gscSiteUrl,
    ga4Connected: !!site?.ga4PropertyId,
    gscLastFetched: null,
    ga4LastFetched: null,
    trend: [],
    totals: { clicks: 0, impressions: 0, ctr: 0, avgPosition: 0, sessions: 0, users: 0, conversions: 0 },
    topQueries: [],
    topPages: [],
    channelBreakdown: [],
    deviceBreakdown: [],
  };
}

export async function getAnalyticsData(): Promise<AnalyticsData> {
  const site = await getActiveSite();
  if (!site) return emptyAnalytics(null);

  const siteRef = { id: site.id, gscSiteUrl: site.gscSiteUrl, ga4PropertyId: site.ga4PropertyId };

  const [gscRows, ga4Rows] = await Promise.all([
    prisma.gscMetric.findMany({ where: { siteId: site.id }, orderBy: { date: "asc" } }),
    prisma.ga4Metric.findMany({ where: { siteId: site.id }, orderBy: { date: "asc" } }),
  ]);

  if (gscRows.length === 0 && ga4Rows.length === 0) return emptyAnalytics(siteRef);

  // Trend: merge both sources by date (YYYY-MM-DD)
  const byDate = new Map<string, { clicks: number; impressions: number; sessions: number; users: number }>();
  const dayKey = (d: Date) => d.toISOString().slice(0, 10);

  for (const r of gscRows) {
    const key = dayKey(r.date);
    const entry = byDate.get(key) ?? { clicks: 0, impressions: 0, sessions: 0, users: 0 };
    entry.clicks += r.clicks;
    entry.impressions += r.impressions;
    byDate.set(key, entry);
  }
  for (const r of ga4Rows) {
    const key = dayKey(r.date);
    const entry = byDate.get(key) ?? { clicks: 0, impressions: 0, sessions: 0, users: 0 };
    entry.sessions += r.sessions;
    entry.users += r.users;
    byDate.set(key, entry);
  }
  const trend = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  const totalClicks = gscRows.reduce((s, r) => s + r.clicks, 0);
  const totalImpressions = gscRows.reduce((s, r) => s + r.impressions, 0);
  const avgPosition = gscRows.length > 0 ? gscRows.reduce((s, r) => s + r.position, 0) / gscRows.length : 0;
  const totalSessions = ga4Rows.reduce((s, r) => s + r.sessions, 0);
  const totalUsers = ga4Rows.reduce((s, r) => s + r.users, 0);
  const totalConversions = ga4Rows.reduce((s, r) => s + r.conversions, 0);

  const queryTotals = new Map<string, { clicks: number; impressions: number; positionSum: number; count: number }>();
  for (const r of gscRows) {
    if (!r.query) continue;
    const e = queryTotals.get(r.query) ?? { clicks: 0, impressions: 0, positionSum: 0, count: 0 };
    e.clicks += r.clicks;
    e.impressions += r.impressions;
    e.positionSum += r.position;
    e.count += 1;
    queryTotals.set(r.query, e);
  }
  const topQueries = [...queryTotals.entries()]
    .map(([query, v]) => ({
      query,
      clicks: v.clicks,
      impressions: v.impressions,
      ctr: v.impressions > 0 ? v.clicks / v.impressions : 0,
      position: v.positionSum / v.count,
    }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 10);

  // GA4's page field is already a path (/pages/specials); GSC's is a full
  // URL (https://omnicenters.com/pages/specials) — normalize both to path
  // form so sessions and clicks join on the same page instead of silently
  // never matching.
  const toPath = (page: string): string => {
    try {
      return new URL(page).pathname || "/";
    } catch {
      return page;
    }
  };

  const pageTotals = new Map<string, { sessions: number; clicks: number }>();
  for (const r of ga4Rows) {
    if (!r.page) continue;
    const key = toPath(r.page);
    const e = pageTotals.get(key) ?? { sessions: 0, clicks: 0 };
    e.sessions += r.sessions;
    pageTotals.set(key, e);
  }
  for (const r of gscRows) {
    if (!r.page) continue;
    const key = toPath(r.page);
    const e = pageTotals.get(key) ?? { sessions: 0, clicks: 0 };
    e.clicks += r.clicks;
    pageTotals.set(key, e);
  }
  const topPages = [...pageTotals.entries()]
    .map(([page, v]) => ({ page, ...v }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 10);

  const channelTotals = new Map<string, number>();
  for (const r of ga4Rows) {
    const key = r.channelGroup ?? "(unknown)";
    channelTotals.set(key, (channelTotals.get(key) ?? 0) + r.sessions);
  }
  const channelBreakdown = [...channelTotals.entries()]
    .map(([channel, sessions]) => ({ channel, sessions }))
    .sort((a, b) => b.sessions - a.sessions);

  const deviceTotals = new Map<string, number>();
  for (const r of ga4Rows) {
    const key = r.deviceCategory ?? "(unknown)";
    deviceTotals.set(key, (deviceTotals.get(key) ?? 0) + r.sessions);
  }
  const deviceBreakdown = [...deviceTotals.entries()]
    .map(([device, sessions]) => ({ device, sessions }))
    .sort((a, b) => b.sessions - a.sessions);

  return {
    site: siteRef,
    gscConnected: !!site.gscSiteUrl,
    ga4Connected: !!site.ga4PropertyId,
    gscLastFetched: gscRows.length > 0 ? gscRows[gscRows.length - 1].fetchedAt : null,
    ga4LastFetched: ga4Rows.length > 0 ? ga4Rows[ga4Rows.length - 1].fetchedAt : null,
    trend,
    totals: {
      clicks: totalClicks,
      impressions: totalImpressions,
      ctr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
      avgPosition,
      sessions: totalSessions,
      users: totalUsers,
      conversions: totalConversions,
    },
    topQueries,
    topPages,
    channelBreakdown,
    deviceBreakdown,
  };
}
