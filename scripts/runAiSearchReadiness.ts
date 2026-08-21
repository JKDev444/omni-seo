/**
 * Manual AI Search Readiness sync: `npx tsx scripts/runAiSearchReadiness.ts [domain] [maxPages]`
 * Costs real money (Claude API calls) — capped at 20 pages by default.
 */
import { PrismaClient } from "@prisma/client";
import { pullAiSearchReadiness } from "../lib/integrations/aiSearchReadinessAnalysis";

const prisma = new PrismaClient();

async function main() {
  const domain = process.argv[2] ?? "omnicenters.com";
  const maxPages = process.argv[3] ? Number(process.argv[3]) : undefined;
  const site = await prisma.site.findUniqueOrThrow({ where: { domain } });

  const result = maxPages ? await pullAiSearchReadiness(site.id, maxPages) : await pullAiSearchReadiness(site.id);
  console.log(result);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
