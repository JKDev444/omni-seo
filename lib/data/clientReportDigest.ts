/**
 * Gathers real data for the LLM to write the monthly client report from
 * — no fabricated numbers should ever reach the prompt. Fields with no
 * real data source (leads/conversions has no CRM/booking integration)
 * are explicitly flagged as such rather than omitted, so the prompt
 * can honestly say "not tracked yet" instead of inventing a number.
 */
import { prisma } from "@/lib/db";

export interface ClientReportDigest {
  month: string;
  findingsSummary: { critical: number; high: number; medium: number; low: number; resolvedThisMonth: number };
  scorecard: { metric: string; baseline: number | null; current: number | null; target: number | null }[];
  gscTrend: { totalClicks: number; totalImpressions: number; avgPosition: number | null };
  ga4Trend: { organicSessions: number };
  keywordMovement: { improved: number; declined: number; newlyRanking: number; totalTracked: number };
  citationStatus: { total: number; napConsistent: number; indexed: number };
  gbp: { rating: number | null; reviewCount: number | null } | null;
  leadsConversionsDataAvailable: false; // always false -- no CRM/booking integration exists
}

const CLOSED_STATUSES = new Set(["COMPLETED", "ALREADY_COMPLETED", "VERIFIED", "IGNORED", "FALSE_POSITIVE", "ACCEPTED"]);

export async function buildClientReportDigest(siteId: string, month: string): Promise<ClientReportDigest> {
  const latestCrawl = await prisma.crawl.findFirst({ where: { siteId, status: "completed" }, orderBy: { startedAt: "desc" } });

  const findings = latestCrawl ? await prisma.finding.findMany({ where: { crawlId: latestCrawl.id } }) : [];
  const open = findings.filter((f) => !CLOSED_STATUSES.has(f.status));
  const resolvedThisMonth = findings.filter((f) => f.status === "COMPLETED").length;

  const scorecardRows = await prisma.scorecardMetric.findMany({ where: { siteId } });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [gscRows, ga4Agg] = await Promise.all([
    prisma.gscMetric.findMany({ where: { siteId, date: { gte: thirtyDaysAgo } }, select: { clicks: true, impressions: true, position: true } }),
    prisma.ga4Metric.aggregate({ where: { siteId, channelGroup: "Organic Search", date: { gte: thirtyDaysAgo } }, _sum: { sessions: true } }),
  ]);
  const totalClicks = gscRows.reduce((s, r) => s + r.clicks, 0);
  const totalImpressions = gscRows.reduce((s, r) => s + r.impressions, 0);
  const avgPosition = gscRows.length > 0 ? Math.round((gscRows.reduce((s, r) => s + r.position, 0) / gscRows.length) * 10) / 10 : null;

  const keywords = await prisma.keyword.findMany({
    where: { siteId, active: true },
    include: { rankings: { orderBy: { checkedAt: "desc" }, take: 2 } },
  });
  let improved = 0;
  let declined = 0;
  let newlyRanking = 0;
  for (const k of keywords) {
    const [latest, previous] = k.rankings;
    if (!latest) continue;
    if (!previous) continue;
    if (latest.position !== null && previous.position === null) newlyRanking++;
    else if (latest.position !== null && previous.position !== null) {
      if (latest.position < previous.position) improved++;
      else if (latest.position > previous.position) declined++;
    }
  }

  const citations = await prisma.citation.findMany({ where: { siteId } });
  const gbpProfile = await prisma.gbpProfile.findUnique({ where: { siteId } });

  return {
    month,
    findingsSummary: {
      critical: open.filter((f) => f.priority === "CRITICAL").length,
      high: open.filter((f) => f.priority === "HIGH").length,
      medium: open.filter((f) => f.priority === "MEDIUM").length,
      low: open.filter((f) => f.priority === "LOW").length,
      resolvedThisMonth,
    },
    scorecard: scorecardRows.map((s) => ({ metric: s.metric, baseline: s.baseline, current: s.current, target: s.target })),
    gscTrend: { totalClicks, totalImpressions, avgPosition },
    ga4Trend: { organicSessions: ga4Agg._sum.sessions ?? 0 },
    keywordMovement: { improved, declined, newlyRanking, totalTracked: keywords.length },
    citationStatus: {
      total: citations.length,
      napConsistent: citations.filter((c) => c.napConsistent === true).length,
      indexed: citations.filter((c) => c.indexed === true).length,
    },
    gbp: gbpProfile ? { rating: gbpProfile.rating, reviewCount: gbpProfile.reviewCount } : null,
    leadsConversionsDataAvailable: false,
  };
}
