/**
 * Phase R's deployment verification gate, scoped to what's actually
 * buildable: this project has no separate staging environment, and
 * building one was flagged as its own decision rather than assumed.
 * But Shopify already gives every theme a native, real preview URL
 * (Admin -> Online Store -> Themes -> Preview, or any
 * `?preview_theme_id=...` link) before publishing -- that's a real,
 * already-available "staging" surface, just not a dedicated server.
 * This checks a preview URL the same way a real crawl checks a
 * production one, and diffs it against the current production
 * snapshot for the matching path using the exact same diffSignals
 * logic crawl-to-crawl regression detection uses -- "did this get
 * worse" is the same question whether the two sides are two crawls or
 * a preview and production.
 */
import * as cheerio from "cheerio";
import { prisma } from "@/lib/db";
import { fetchWithRedirects } from "@/lib/crawler/fetchWithRedirects";
import { classifyPageType } from "@/lib/crawler/crawl";
import { runAllChecks, type RawFinding } from "@/lib/checks/onPageChecks";
import { diffSignals, type SnapshotSignal } from "@/lib/checks/regressionDetection";

export interface PreDeployResult {
  previewUrl: string;
  matchedProductionUrl: string | null;
  regressions: string[];
  findings: RawFinding[];
  fetchError: string | null;
}

function extractSignals(url: string, statusCode: number, html: string): SnapshotSignal {
  const $ = cheerio.load(html);
  const schemaTypes: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).text());
      const type = parsed["@type"];
      if (type) schemaTypes.push(...(Array.isArray(type) ? type : [type]));
    } catch {
      // invalid JSON-LD is a separate, already-covered finding, not this function's concern
    }
  });

  return {
    url,
    statusCode,
    title: $("title").first().text().trim() || null,
    metaDesc: $('meta[name="description"]').attr("content")?.trim() || null,
    canonical: $('link[rel="canonical"]').attr("href")?.trim() || null,
    h1: $("h1").first().text().trim() || null,
    schemaTypes,
  };
}

/**
 * `previewUrl` can be any real URL the theme actually renders at
 * (Shopify preview, a `?preview_theme_id=` link, or even a production
 * URL if you just want a one-off recheck). Matches to a production Page
 * by pathname so the preview domain/query string doesn't have to match
 * production exactly.
 */
export async function checkPreviewUrl(siteId: string, previewUrl: string): Promise<PreDeployResult> {
  const fetchResult = await fetchWithRedirects(previewUrl);

  if (!fetchResult.html) {
    return {
      previewUrl,
      matchedProductionUrl: null,
      regressions: [],
      findings: [],
      fetchError: `Could not fetch a real page — final status ${fetchResult.finalStatus}${fetchResult.loop ? " (redirect loop)" : ""}${fetchResult.tooManyRedirects ? " (too many redirects)" : ""}.`,
    };
  }

  let pathname: string;
  try {
    pathname = new URL(previewUrl).pathname;
  } catch {
    return { previewUrl, matchedProductionUrl: null, regressions: [], findings: [], fetchError: `"${previewUrl}" isn't a valid URL.` };
  }

  const site = await prisma.site.findUniqueOrThrow({ where: { id: siteId } });
  const productionUrl = `https://${site.domain}${pathname === "/" ? "" : pathname}` || `https://${site.domain}/`;
  const pageType = classifyPageType(previewUrl);

  const allTitles = await prisma.page.findMany({ where: { siteId }, select: { url: true, title: true } });
  const allTitlesOnSite = new Map<string, string[]>();
  for (const p of allTitles) {
    if (!p.title) continue;
    const existing = allTitlesOnSite.get(p.title) ?? [];
    existing.push(p.url);
    allTitlesOnSite.set(p.title, existing);
  }

  const findings = runAllChecks({
    url: previewUrl,
    statusCode: fetchResult.finalStatus,
    rawHtml: fetchResult.html,
    pageType,
    allTitlesOnSite,
  });

  const productionPage = await prisma.page.findFirst({ where: { siteId, url: productionUrl } });
  let regressions: string[] = [];
  let matchedProductionUrl: string | null = null;

  if (productionPage) {
    matchedProductionUrl = productionUrl;
    const latestSnapshot = await prisma.pageSnapshot.findFirst({
      where: { pageId: productionPage.id },
      orderBy: { createdAt: "desc" },
    });

    if (latestSnapshot) {
      const prevSignal: SnapshotSignal = {
        url: productionUrl,
        statusCode: latestSnapshot.statusCode,
        title: latestSnapshot.title,
        metaDesc: latestSnapshot.metaDesc,
        canonical: latestSnapshot.canonical,
        h1: latestSnapshot.h1,
        schemaTypes: latestSnapshot.schemaTypes,
      };
      const currSignal = extractSignals(previewUrl, fetchResult.finalStatus, fetchResult.html);
      regressions = diffSignals(prevSignal, currSignal);
    }
  }

  return { previewUrl, matchedProductionUrl, regressions, findings, fetchError: null };
}
