import { prisma } from "@/lib/db";
import { getActiveSite } from "@/lib/data/activeSite";

export interface ContentRow {
  url: string;
  headingIntentScore: number | null;
  introQualityScore: number | null;
  entityCoverageScore: number | null;
  trustSignalsScore: number | null;
  freshnessScore: number | null;
  ctaConsistencyScore: number | null;
  overallScore: number | null;
  fetchedAt: Date;
}

export interface ContentAnalysisData {
  site: { id: string } | null;
  hasData: boolean;
  rows: ContentRow[];
  avgScore: number | null;
}

function avg(scores: (number | null)[]): number | null {
  const present = scores.filter((s): s is number => s !== null);
  return present.length > 0 ? Math.round(present.reduce((a, b) => a + b, 0) / present.length) : null;
}

export async function getContentAnalysisData(): Promise<ContentAnalysisData> {
  const site = await getActiveSite();
  if (!site) return { site: null, hasData: false, rows: [], avgScore: null };

  const analyses = await prisma.contentAnalysis.findMany({ where: { siteId: site.id }, orderBy: { url: "asc" } });
  if (analyses.length === 0) return { site: { id: site.id }, hasData: false, rows: [], avgScore: null };

  const rows: ContentRow[] = analyses.map((a) => ({
    url: a.url,
    headingIntentScore: a.headingIntentScore,
    introQualityScore: a.introQualityScore,
    entityCoverageScore: a.entityCoverageScore,
    trustSignalsScore: a.trustSignalsScore,
    freshnessScore: a.freshnessScore,
    ctaConsistencyScore: a.ctaConsistencyScore,
    overallScore: avg([a.headingIntentScore, a.introQualityScore, a.entityCoverageScore, a.trustSignalsScore, a.freshnessScore, a.ctaConsistencyScore]),
    fetchedAt: a.fetchedAt,
  }));

  return {
    site: { id: site.id },
    hasData: true,
    rows: rows.sort((a, b) => (a.overallScore ?? 100) - (b.overallScore ?? 100)),
    avgScore: avg(rows.map((r) => r.overallScore)),
  };
}
