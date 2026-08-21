/**
 * Manual Scorecard update: `npx tsx scripts/updateScorecard.ts [domain]`
 * Free -- computes from data already in the database, no new API calls.
 *
 * On a metric's first real computation, baseline is frozen at that
 * value (establishing "today" as the real starting point) and never
 * touched again -- every later run only updates "current", so the
 * baseline stays a fixed historical reference and the current value
 * shows real progress against it.
 */
import { PrismaClient } from "@prisma/client";
import { computeRealScorecardMetrics } from "../lib/data/scorecardMetrics";

const prisma = new PrismaClient();

async function main() {
  const domain = process.argv[2] ?? "omnicenters.com";
  const site = await prisma.site.findUniqueOrThrow({ where: { domain } });

  const metrics = await computeRealScorecardMetrics(site.id);
  console.log(`Computed ${metrics.length} real metrics.`);

  for (const m of metrics) {
    const existing = await prisma.scorecardMetric.findUnique({ where: { siteId_metric: { siteId: site.id, metric: m.metric } } });

    await prisma.scorecardMetric.upsert({
      where: { siteId_metric: { siteId: site.id, metric: m.metric } },
      update: { current: m.current, source: m.source },
      create: { siteId: site.id, metric: m.metric, baseline: m.current, current: m.current, target: m.target, source: m.source },
    });

    console.log(
      existing
        ? `${m.metric}: ${existing.current} -> ${m.current} (baseline stays ${existing.baseline})`
        : `${m.metric}: first real measurement — baseline and current both set to ${m.current}`
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
