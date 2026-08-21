/**
 * Phase R: regression detection — diffs this crawl's PageSnapshot against
 * the same page's snapshot from the previous crawl, and flags anything
 * that regressed (title/meta/H1/canonical disappeared, a schema type
 * disappeared, status code got worse). Same consolidation reasoning as
 * the systemic schema gap check: if the same regression hits many pages
 * at once, that's almost certainly one shared cause (a theme deploy, an
 * app update), not N unrelated coincidences — one finding naming the
 * pattern is far more useful than N near-duplicates.
 */
import { prisma } from "@/lib/db";
import type { RawFinding } from "./onPageChecks";

const SYSTEMIC_THRESHOLD = 3;

interface SnapshotSignal {
  url: string;
  statusCode: number | null;
  title: string | null;
  metaDesc: string | null;
  canonical: string | null;
  h1: string | null;
  schemaTypes: string[];
}

interface Regression {
  url: string;
  type: string; // e.g. "lost meta description", "status code 200 -> 404"
}

function diffSignals(prev: SnapshotSignal, curr: SnapshotSignal): string[] {
  const regressions: string[] = [];

  if (prev.title && !curr.title) regressions.push("lost title tag");
  if (prev.metaDesc && !curr.metaDesc) regressions.push("lost meta description");
  if (prev.h1 && !curr.h1) regressions.push("lost H1");
  if (prev.canonical && !curr.canonical) regressions.push("lost canonical tag");

  const lostSchemaTypes = prev.schemaTypes.filter((t) => !curr.schemaTypes.includes(t));
  for (const type of lostSchemaTypes) regressions.push(`lost ${type} schema`);

  // A status regression is "got worse", not just "changed" -- 200 -> 301
  // for a deliberate redirect isn't a regression, but 200 -> anything
  // 400+ (or null, meaning the fetch failed outright) genuinely is.
  if (prev.statusCode === 200 && curr.statusCode !== null && curr.statusCode >= 400) {
    regressions.push(`status code 200 -> ${curr.statusCode}`);
  }
  if (prev.statusCode === 200 && curr.statusCode === null) {
    regressions.push("status code 200 -> failed to fetch");
  }

  return regressions;
}

/** Sitewide: compares this crawl's snapshots against the site's previous completed crawl, per page. */
export async function detectRegressions(siteId: string, currentCrawlId: string): Promise<{ url: string; finding: RawFinding }[]> {
  const previousCrawl = await prisma.crawl.findFirst({
    where: { siteId, status: "completed", id: { not: currentCrawlId } },
    orderBy: { startedAt: "desc" },
  });
  if (!previousCrawl) return []; // first crawl for this site -- nothing to diff against

  const [prevSnapshots, currSnapshots] = await Promise.all([
    prisma.pageSnapshot.findMany({ where: { crawlId: previousCrawl.id }, include: { page: { select: { url: true } } } }),
    prisma.pageSnapshot.findMany({ where: { crawlId: currentCrawlId }, include: { page: { select: { url: true } } } }),
  ]);

  const prevByPageId = new Map(prevSnapshots.map((s) => [s.pageId, s]));
  const regressions: Regression[] = [];

  for (const curr of currSnapshots) {
    const prev = prevByPageId.get(curr.pageId);
    if (!prev) continue; // page is new this crawl -- nothing to regress from

    const prevSignal: SnapshotSignal = {
      url: prev.page.url,
      statusCode: prev.statusCode,
      title: prev.title,
      metaDesc: prev.metaDesc,
      canonical: prev.canonical,
      h1: prev.h1,
      schemaTypes: prev.schemaTypes,
    };
    const currSignal: SnapshotSignal = {
      url: curr.page.url,
      statusCode: curr.statusCode,
      title: curr.title,
      metaDesc: curr.metaDesc,
      canonical: curr.canonical,
      h1: curr.h1,
      schemaTypes: curr.schemaTypes,
    };

    for (const type of diffSignals(prevSignal, currSignal)) {
      regressions.push({ url: curr.page.url, type });
    }
  }

  if (regressions.length === 0) return [];

  // Consolidate: same regression type hitting 3+ pages becomes one
  // finding naming the pattern and listing example pages, instead of N
  // near-duplicates burying the real signal (a shared cause) in noise.
  const byType = new Map<string, string[]>();
  for (const r of regressions) {
    const urls = byType.get(r.type) ?? [];
    urls.push(r.url);
    byType.set(r.type, urls);
  }

  const results: { url: string; finding: RawFinding }[] = [];

  for (const [type, urls] of byType) {
    const isStatusRegression = type.startsWith("status code");
    const priority = isStatusRegression ? "CRITICAL" : urls.length >= SYSTEMIC_THRESHOLD ? "HIGH" : "MEDIUM";

    if (urls.length >= SYSTEMIC_THRESHOLD) {
      results.push({
        url: urls[0],
        finding: {
          category: "technical",
          checkStep: "Regression Detection",
          title: `${urls.length} pages regressed: ${type}`,
          description: `Since the last crawl, ${urls.length} pages changed in the same way: ${type}. This many pages changing identically at once is almost certainly one shared cause (a theme deploy, an app update, a template change) rather than ${urls.length} separate coincidences. Example pages: ${urls.slice(0, 5).join(", ")}${urls.length > 5 ? `, and ${urls.length - 5} more` : ""}.`,
          fixType: "Check what changed sitewide since the last crawl (theme deploy, app install/update, bulk edit) and confirm this was intentional.",
          priority,
          fixLocation: "Theme Liquid",
        },
      });
    } else {
      for (const url of urls) {
        results.push({
          url,
          finding: {
            category: "technical",
            checkStep: "Regression Detection",
            title: `Regression: ${type}`,
            description: `This page changed since the last crawl: ${type}.`,
            fixType: "Confirm this was intentional; restore the previous value if not.",
            priority,
            fixLocation: "Theme Liquid",
          },
        });
      }
    }
  }

  return results;
}
