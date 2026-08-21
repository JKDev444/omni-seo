/**
 * Manual client report generation: `npx tsx scripts/generateClientReport.ts [domain] [month]`
 * month defaults to the current month ("2026-08"). Real Anthropic API cost, one call.
 */
import { PrismaClient } from "@prisma/client";
import { pullClientReport } from "../lib/integrations/clientReportAnalysis";
import { monthKey } from "../lib/maintenance/seedMonth";

const prisma = new PrismaClient();

async function main() {
  const domain = process.argv[2] ?? "omnicenters.com";
  const month = process.argv[3] ?? monthKey();
  const site = await prisma.site.findUniqueOrThrow({ where: { domain } });

  const result = await pullClientReport(site.id, month);
  console.log(result);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
