/**
 * Manual GSC + GA4 sync: `npx tsx scripts/syncAnalytics.ts`
 * Vercel Cron will call the same functions once that's wired up (Phase R).
 */
import { PrismaClient } from "@prisma/client";
import { pullGscMetrics } from "../lib/integrations/gsc";
import { pullGa4Metrics } from "../lib/integrations/ga4";

const prisma = new PrismaClient();

async function main() {
  const domain = process.argv[2] ?? "omnicenters.com";
  const site = await prisma.site.findUniqueOrThrow({ where: { domain } });

  const gsc = await pullGscMetrics(site.id);
  console.log("GSC:", gsc);

  const ga4 = await pullGa4Metrics(site.id);
  console.log("GA4:", ga4);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
