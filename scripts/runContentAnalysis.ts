/**
 * Manual content review sync: `npx tsx scripts/runContentAnalysis.ts`
 * Vercel Cron will call the same function once that's wired up (Phase R).
 * Costs real money (Claude API calls) — capped at 20 pages by default.
 */
import { PrismaClient } from "@prisma/client";
import { pullContentAnalysis } from "../lib/integrations/contentAnalysis";

const prisma = new PrismaClient();

async function main() {
  const domain = process.argv[2] ?? "omnicenters.com";
  const site = await prisma.site.findUniqueOrThrow({ where: { domain } });

  const result = await pullContentAnalysis(site.id);
  console.log(result);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
