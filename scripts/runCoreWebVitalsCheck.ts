/**
 * Manual CWV sync: `npx tsx scripts/runCoreWebVitalsCheck.ts`
 * Vercel Cron will call the same function once that's wired up (Phase R).
 */
import { PrismaClient } from "@prisma/client";
import { pullCoreWebVitals } from "../lib/integrations/coreWebVitals";

const prisma = new PrismaClient();

async function main() {
  const domain = process.argv[2] ?? "omnicenters.com";
  const site = await prisma.site.findUniqueOrThrow({ where: { domain } });

  const result = await pullCoreWebVitals(site.id);
  console.log(result);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
