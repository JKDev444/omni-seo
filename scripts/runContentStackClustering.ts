/**
 * Manual content-stack clustering: `npx tsx scripts/runContentStackClustering.ts`
 * Costs real money (one Claude API call covering all pages, not per-page).
 * Re-running replaces all existing stacks for the site.
 */
import { PrismaClient } from "@prisma/client";
import { pullContentStackClustering } from "../lib/data/contentStacks";

const prisma = new PrismaClient();

async function main() {
  const domain = process.argv[2] ?? "omnicenters.com";
  const site = await prisma.site.findUniqueOrThrow({ where: { domain } });

  const result = await pullContentStackClustering(site.id);
  console.log(result);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
