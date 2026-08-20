/**
 * Seeds tracked keywords two ways:
 *   npx tsx scripts/seedKeywords.ts suggest [domain]   — lists GSC-derived suggestions (no writes)
 *   npx tsx scripts/seedKeywords.ts accept [domain] "phrase 1" "phrase 2" ...   — adds specific suggested/manual phrases
 */
import { PrismaClient } from "@prisma/client";
import { suggestKeywordsFromGsc } from "../lib/data/keywordSuggestions";

const prisma = new PrismaClient();

async function main() {
  const mode = process.argv[2];
  const domain = process.argv[3] ?? "omnicenters.com";
  const site = await prisma.site.findUniqueOrThrow({ where: { domain } });

  if (mode === "suggest") {
    const suggestions = await suggestKeywordsFromGsc(site.id);
    console.log(`${suggestions.length} suggested keywords (not yet tracked):\n`);
    suggestions.forEach((s, i) =>
      console.log(`${i + 1}. "${s.phrase}" — ${s.impressions} impressions, ${s.clicks} clicks, avg pos ${s.avgPosition} — ${s.targetUrl ?? "(no page)"}`)
    );
    return;
  }

  if (mode === "accept") {
    const phrases = process.argv.slice(4);
    if (phrases.length === 0) {
      console.error('Usage: npx tsx scripts/seedKeywords.ts accept [domain] "phrase 1" "phrase 2" ...');
      process.exit(1);
    }

    const suggestions = await suggestKeywordsFromGsc(site.id, 1000);
    const byPhrase = new Map(suggestions.map((s) => [s.phrase.toLowerCase(), s]));

    for (const phrase of phrases) {
      const match = byPhrase.get(phrase.toLowerCase());
      await prisma.keyword.upsert({
        where: { siteId_phrase: { siteId: site.id, phrase } },
        update: {},
        create: {
          siteId: site.id,
          phrase,
          targetUrl: match?.targetUrl ?? null,
          source: match ? "gsc_suggested" : "manual",
        },
      });
      console.log(`Added: "${phrase}"${match ? ` (matched GSC data: ${match.impressions} impressions)` : " (manual)"}`);
    }
    return;
  }

  console.error('Usage:\n  npx tsx scripts/seedKeywords.ts suggest [domain]\n  npx tsx scripts/seedKeywords.ts accept [domain] "phrase 1" "phrase 2" ...');
  process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
