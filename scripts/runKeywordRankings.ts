/**
 * Manual rank-check sync: `npx tsx scripts/runKeywordRankings.ts`
 * Vercel Cron will call the same function once wired up (Phase R).
 * Costs real money (DataForSEO SERP API calls per keyword).
 */
import { PrismaClient } from "@prisma/client";
import { runKeywordRankings, backfillKeywordVolume } from "../lib/data/keywordRanking";

const prisma = new PrismaClient();

async function main() {
  const domain = process.argv[2] ?? "omnicenters.com";
  const site = await prisma.site.findUniqueOrThrow({ where: { domain } });

  const volumeResult = await backfillKeywordVolume(site.id);
  console.log("Volume backfill:", volumeResult);

  const rankResult = await runKeywordRankings(site.id);
  console.log("Rank check:", rankResult);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
