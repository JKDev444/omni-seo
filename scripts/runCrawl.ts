/**
 * Manual crawl trigger: `npm run crawl -- omnicenters.com`
 * The Vercel Cron job will call the same crawlSite() via an API route
 * once that's wired up (step 5).
 */
import { PrismaClient } from "@prisma/client";
import { crawlSite } from "../lib/crawler/crawl";

const prisma = new PrismaClient();

async function main() {
  const domain = process.argv[2] ?? "omnicenters.com";
  const site = await prisma.site.upsert({
    where: { domain },
    update: {},
    create: { domain, platform: "shopify" },
  });

  const result = await crawlSite(site.id, domain);
  console.log(`Crawl complete for ${domain}:`, result);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
