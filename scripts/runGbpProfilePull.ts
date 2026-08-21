/**
 * Manual GBP public data sync: `npx tsx scripts/runGbpProfilePull.ts`
 * Populates GbpProfile so the next crawl's NAP consistency check has a
 * real GBP source to cross-check against, instead of "unavailable."
 */
import { PrismaClient } from "@prisma/client";
import { pullGbpProfile } from "../lib/localSeo/runLocalSeoAudit";

const prisma = new PrismaClient();

async function main() {
  const domain = process.argv[2] ?? "omnicenters.com";
  const site = await prisma.site.findUniqueOrThrow({ where: { domain } });

  const result = await pullGbpProfile(site.id);
  console.log(result);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
