import { prisma } from "@/lib/db";
import { buildClientReportDigest } from "@/lib/data/clientReportDigest";
import { generateClientReport } from "./clientReportGeneration";

export async function pullClientReport(
  siteId: string,
  month: string
): Promise<{ ok: boolean; message?: string }> {
  const digest = await buildClientReportDigest(siteId, month);
  const result = await generateClientReport(digest);

  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  const s = result.sections;
  await prisma.clientReport.upsert({
    where: { siteId_month: { siteId, month } },
    update: {
      technicalHealth: s.technicalHealth,
      contentImprovements: s.contentImprovements,
      localSeo: s.localSeo,
      performance: s.performance,
      rankingsTraffic: s.rankingsTraffic,
      leadsConversions: s.leadsConversions,
      nextMonthPriorities: s.nextMonthPriorities,
    },
    create: {
      siteId,
      month,
      technicalHealth: s.technicalHealth,
      contentImprovements: s.contentImprovements,
      localSeo: s.localSeo,
      performance: s.performance,
      rankingsTraffic: s.rankingsTraffic,
      leadsConversions: s.leadsConversions,
      nextMonthPriorities: s.nextMonthPriorities,
    },
  });

  return { ok: true };
}
