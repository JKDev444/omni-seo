import { prisma } from "@/lib/db";
import { V1_DOMAIN } from "@/lib/data/dashboard";

export interface AiSearchReadinessRow {
  url: string;
  entityClarityScore: number | null;
  citationReadinessScore: number | null;
  extractabilityScore: number | null;
  hasAnswerBlock: boolean;
  overallScore: number | null;
  fetchedAt: Date;
}

export interface AiSearchReadinessData {
  site: { id: string } | null;
  hasData: boolean;
  rows: AiSearchReadinessRow[];
  avgScore: number | null;
  answerBlockCoverage: number | null; // % of reviewed pages with a direct answer block
}

function avg(scores: (number | null)[]): number | null {
  const present = scores.filter((s): s is number => s !== null);
  return present.length > 0 ? Math.round(present.reduce((a, b) => a + b, 0) / present.length) : null;
}

export async function getAiSearchReadinessData(): Promise<AiSearchReadinessData> {
  const site = await prisma.site.findUnique({ where: { domain: V1_DOMAIN } });
  if (!site) return { site: null, hasData: false, rows: [], avgScore: null, answerBlockCoverage: null };

  const analyses = await prisma.aiSearchReadiness.findMany({ where: { siteId: site.id }, orderBy: { url: "asc" } });
  if (analyses.length === 0) return { site: { id: site.id }, hasData: false, rows: [], avgScore: null, answerBlockCoverage: null };

  const rows: AiSearchReadinessRow[] = analyses.map((a) => ({
    url: a.url,
    entityClarityScore: a.entityClarityScore,
    citationReadinessScore: a.citationReadinessScore,
    extractabilityScore: a.extractabilityScore,
    hasAnswerBlock: a.hasAnswerBlock,
    overallScore: avg([a.entityClarityScore, a.citationReadinessScore, a.extractabilityScore]),
    fetchedAt: a.fetchedAt,
  }));

  return {
    site: { id: site.id },
    hasData: true,
    rows: rows.sort((a, b) => (a.overallScore ?? 100) - (b.overallScore ?? 100)),
    avgScore: avg(rows.map((r) => r.overallScore)),
    answerBlockCoverage: Math.round((rows.filter((r) => r.hasAnswerBlock).length / rows.length) * 100),
  };
}
