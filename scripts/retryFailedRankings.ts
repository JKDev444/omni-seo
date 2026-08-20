/**
 * Retries rank checks only for keywords with zero KeywordRanking rows —
 * used after a batch run that hit transient DataForSEO server errors
 * (40101) on a subset of keywords, rather than re-checking everything.
 */
import { PrismaClient } from "@prisma/client";
import { checkKeywordRank } from "../lib/integrations/dataforseo";

const prisma = new PrismaClient();

async function main() {
  const domain = process.argv[2] ?? "omnicenters.com";
  const site = await prisma.site.findUniqueOrThrow({ where: { domain } });
  const locationCode = site.dataForSeoLocationCode ?? 1027784;
  const languageCode = site.dataForSeoLanguageCode ?? "en";

  const unchecked = await prisma.keyword.findMany({
    where: { siteId: site.id, active: true, rankings: { none: {} } },
  });

  console.log(`Retrying ${unchecked.length} keywords with no ranking data yet.`);

  let checked = 0;
  let errors = 0;
  for (const kw of unchecked) {
    const result = await checkKeywordRank(kw.phrase, site.domain, locationCode, languageCode);
    if (!result.ok) {
      console.log(`FAILED: "${kw.phrase}" — ${result.message}`);
      errors++;
      continue;
    }
    await prisma.keywordRanking.create({
      data: {
        keywordId: kw.id,
        position: result.data.position,
        rankingUrl: result.data.rankingUrl,
        localPack: result.data.localPack,
        aiOverview: result.data.aiOverview,
        serpFeatures: result.data.serpFeatures,
      },
    });
    checked++;
  }

  console.log(`Retry complete: ${checked} succeeded, ${errors} still failing.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
