/**
 * Keyword discovery ("keyword planner"): `npx tsx scripts/runKeywordDiscovery.ts [domain]`
 * Real DataForSEO Labs API cost per run — monthly cadence (see
 * .github/workflows/monthly-seo-sync.yml), same pattern as backlinks.
 */
import { PrismaClient } from "@prisma/client";
import { runKeywordDiscovery } from "../lib/data/keywordDiscovery";

const prisma = new PrismaClient();

async function main() {
  const domain = process.argv[2] ?? "omnicenters.com";
  const site = await prisma.site.findUniqueOrThrow({ where: { domain } });

  const result = await runKeywordDiscovery(site.id);
  console.log("Keyword discovery:", result);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
