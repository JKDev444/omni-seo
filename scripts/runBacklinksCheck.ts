/**
 * Manual backlinks + competitor gap sync:
 *   npx tsx scripts/runBacklinksCheck.ts [domain] [competitor1,competitor2,...]
 * Costs real money (DataForSEO Backlinks API calls per domain).
 */
import { PrismaClient } from "@prisma/client";
import { pullBacklinkProfiles } from "../lib/data/backlinks";

const prisma = new PrismaClient();

const DEFAULT_COMPETITORS = [
  "dermamedispa.com",
  "rejuvenateolympia.com",
  "skinmvmt.com",
  "pearlplasticsurgery.com",
  "olymedspa.com",
];

async function main() {
  const domain = process.argv[2] ?? "omnicenters.com";
  const competitors = process.argv[3] ? process.argv[3].split(",") : DEFAULT_COMPETITORS;
  const site = await prisma.site.findUniqueOrThrow({ where: { domain } });

  const result = await pullBacklinkProfiles(site.id, domain, competitors);
  console.log(result);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
