/**
 * Manual CTR rewrite generation: `npx tsx scripts/runCtrRewrites.ts`
 * Costs real money (Claude API calls) — capped at 20 pages by default,
 * highest-impression CTR opportunities first.
 */
import { PrismaClient } from "@prisma/client";
import { pullCtrRewriteSuggestions } from "../lib/data/ctrRewrites";

const prisma = new PrismaClient();

async function main() {
  const domain = process.argv[2] ?? "omnicenters.com";
  const site = await prisma.site.findUniqueOrThrow({ where: { domain } });

  const result = await pullCtrRewriteSuggestions(site.id);
  console.log(result);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
