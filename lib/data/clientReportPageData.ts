import { prisma } from "@/lib/db";
import { V1_DOMAIN } from "@/lib/data/dashboard";

export interface ClientReportPageData {
  site: { id: string } | null;
  reports: {
    month: string;
    technicalHealth: string | null;
    contentImprovements: string | null;
    localSeo: string | null;
    performance: string | null;
    rankingsTraffic: string | null;
    leadsConversions: string | null;
    nextMonthPriorities: string | null;
    createdAt: Date;
  }[];
}

export async function getClientReportPageData(): Promise<ClientReportPageData> {
  const site = await prisma.site.findUnique({ where: { domain: V1_DOMAIN } });
  if (!site) return { site: null, reports: [] };

  const reports = await prisma.clientReport.findMany({ where: { siteId: site.id }, orderBy: { month: "desc" } });

  return {
    site: { id: site.id },
    reports: reports.map((r) => ({
      month: r.month,
      technicalHealth: r.technicalHealth,
      contentImprovements: r.contentImprovements,
      localSeo: r.localSeo,
      performance: r.performance,
      rankingsTraffic: r.rankingsTraffic,
      leadsConversions: r.leadsConversions,
      nextMonthPriorities: r.nextMonthPriorities,
      createdAt: r.createdAt,
    })),
  };
}
