import { prisma } from "@/lib/db";
import { getActiveSite } from "@/lib/data/activeSite";

export interface CwvRow {
  url: string;
  formFactor: string;
  lcpMs: number | null;
  lcpRating: string | null;
  inpMs: number | null;
  inpRating: string | null;
  cls: number | null;
  clsRating: string | null;
  isOriginFallback: boolean;
}

export interface CwvData {
  site: { id: string } | null;
  connected: boolean;
  lastFetched: Date | null;
  fieldRows: CwvRow[];
  homepagePsi: { performanceScore: number | null; opportunities: { id: string; title: string; savingsMs: number | null }[] } | null;
  summary: { good: number; needsImprovement: number; poor: number };
}

export async function getCoreWebVitalsData(): Promise<CwvData> {
  const site = await getActiveSite();
  if (!site) return { site: null, connected: false, lastFetched: null, fieldRows: [], homepagePsi: null, summary: { good: 0, needsImprovement: 0, poor: 0 } };

  const rows = await prisma.coreWebVitals.findMany({ where: { siteId: site.id, source: "CRUX_FIELD" }, orderBy: { url: "asc" } });
  const psiRow = await prisma.coreWebVitals.findFirst({ where: { siteId: site.id, source: "PSI_LAB" } });

  const summary = { good: 0, needsImprovement: 0, poor: 0 };
  for (const r of rows) {
    for (const rating of [r.lcpRating, r.inpRating, r.clsRating]) {
      if (rating === "good") summary.good++;
      else if (rating === "needs-improvement") summary.needsImprovement++;
      else if (rating === "poor") summary.poor++;
    }
  }

  return {
    site: { id: site.id },
    connected: rows.length > 0 || !!psiRow,
    lastFetched: rows.reduce<Date | null>((max, r) => (!max || r.fetchedAt > max ? r.fetchedAt : max), null),
    fieldRows: rows.map((r) => ({
      url: r.url,
      formFactor: r.formFactor,
      lcpMs: r.lcpMs,
      lcpRating: r.lcpRating,
      inpMs: r.inpMs,
      inpRating: r.inpRating,
      cls: r.cls,
      clsRating: r.clsRating,
      isOriginFallback: r.isOriginFallback,
    })),
    homepagePsi: psiRow
      ? {
          performanceScore: psiRow.performanceScore,
          opportunities: (psiRow.topOpportunities as { id: string; title: string; savingsMs: number | null }[] | null) ?? [],
        }
      : null,
    summary,
  };
}
