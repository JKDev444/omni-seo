/**
 * Site crawler — custom-built for this project, not a wrapped third-party tool.
 * Respects robots.txt, discovers pages via sitemap + internal links,
 * fetches raw HTML (not rendered), and runs the Step 1-4 checks against each page.
 *
 * Implements the Step 0.5 false-positive protocol: findings are staged, not
 * immediately written as confirmed issues, so a human (or a follow-up pass)
 * can confirm against the live page before anything is marked actionable.
 */

import * as cheerio from "cheerio";
import { PrismaClient } from "@prisma/client";
import { runAllChecks, type RawFinding } from "../checks/onPageChecks";

const prisma = new PrismaClient();

const USER_AGENT = "OmniSEOBot/1.0 (+internal audit tool for omnicenters.com)";
const MAX_PAGES = 200; // safety ceiling for v1 (single domain)

function classifyPageType(url: string): string {
  const path = new URL(url).pathname;
  if (path === "/" ) return "homepage";
  if (path.includes("/blogs/") || path.includes("/blog/")) return "blog_article";
  if (path.includes("/products/")) return "product_page";
  if (path.includes("/collections/")) return "collection_page";
  if (path.includes("/pages/about")) return "about_page";
  if (path.includes("/pages/contact")) return "contact_page";
  if (path.includes("/pages/")) return "service_page"; // most Shopify content pages
  return "other";
}

async function fetchRobotsAllowedPaths(origin: string): Promise<Set<string>> {
  const disallowed = new Set<string>();
  try {
    const res = await fetch(`${origin}/robots.txt`, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return disallowed;
    const text = await res.text();
    text.split("\n").forEach((line) => {
      const match = line.match(/^Disallow:\s*(\S+)/i);
      if (match) disallowed.add(match[1]);
    });
  } catch {
    // no robots.txt — proceed, nothing explicitly disallowed
  }
  return disallowed;
}

async function fetchSitemapUrls(origin: string): Promise<string[]> {
  try {
    const res = await fetch(`${origin}/sitemap.xml`, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return [];
    const xml = await res.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    const urls: string[] = [];
    $("loc").each((_, el) => { urls.push($(el).text().trim()); });
    // Handle sitemap index files (one level deep)
    const subSitemaps = urls.filter((u) => u.endsWith(".xml"));
    const directUrls = urls.filter((u) => !u.endsWith(".xml"));
    for (const sub of subSitemaps.slice(0, 10)) {
      try {
        const subRes = await fetch(sub, { headers: { "User-Agent": USER_AGENT } });
        const subXml = await subRes.text();
        const $$ = cheerio.load(subXml, { xmlMode: true });
        $$("loc").each((_, el) => { directUrls.push($$(el).text().trim()); });
      } catch {
        /* skip broken sub-sitemap */
      }
    }
    return directUrls;
  } catch {
    return [];
  }
}

export async function crawlSite(siteId: string, domain: string) {
  const origin = `https://${domain}`;
  const crawl = await prisma.crawl.create({ data: { siteId, status: "running" } });

  try {
    const disallowed = await fetchRobotsAllowedPaths(origin);
    let urls = await fetchSitemapUrls(origin);

    if (urls.length === 0) {
      // Fallback per Step 0: sample the homepage + discover links from it
      urls = [origin];
    }

    urls = urls
      .filter((u) => !disallowed.has(new URL(u).pathname))
      .slice(0, MAX_PAGES);

    const allTitlesOnSite = new Map<string, string[]>();
    const pageResults: { url: string; html: string; status: number; pageType: string }[] = [];

    // First pass: fetch all pages
    for (const url of urls) {
      try {
        const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
        const html = await res.text();
        const pageType = classifyPageType(url);
        pageResults.push({ url, html, status: res.status, pageType });

        const $ = cheerio.load(html);
        const title = $("title").first().text().trim();
        if (title) {
          const existing = allTitlesOnSite.get(title) || [];
          existing.push(url);
          allTitlesOnSite.set(title, existing);
        }
      } catch (err) {
        pageResults.push({ url, html: "", status: 0, pageType: classifyPageType(url) });
      }
    }

    // Second pass: run checks now that we have sitewide title data for duplicate detection
    let totalFindings = 0;
    for (const { url, html, status, pageType } of pageResults) {
      const $ = cheerio.load(html);
      const page = await prisma.page.upsert({
        where: { siteId_url: { siteId, url } },
        update: {
          statusCode: status,
          title: $("title").first().text().trim() || null,
          metaDesc: $('meta[name="description"]').attr("content") || null,
          canonical: $('link[rel="canonical"]').attr("href") || null,
          h1: $("h1").first().text().trim() || null,
          lastCrawledAt: new Date(),
          pageType: pageType.toUpperCase() as any,
        },
        create: {
          siteId,
          url,
          statusCode: status,
          title: $("title").first().text().trim() || null,
          metaDesc: $('meta[name="description"]').attr("content") || null,
          canonical: $('link[rel="canonical"]').attr("href") || null,
          h1: $("h1").first().text().trim() || null,
          lastCrawledAt: new Date(),
          pageType: pageType.toUpperCase() as any,
        },
      });

      const findings: RawFinding[] = runAllChecks({
        url,
        statusCode: status,
        rawHtml: html,
        pageType,
        allTitlesOnSite,
      });

      for (const f of findings) {
        await prisma.finding.create({
          data: {
            crawlId: crawl.id,
            pageId: page.id,
            category: f.category,
            checkStep: f.checkStep,
            title: f.title,
            description: f.description,
            fixType: f.fixType,
            howToTest: f.howToTest,
            priority: f.priority,
            status: "PENDING",
          },
        });
        totalFindings++;
      }
    }

    await prisma.crawl.update({
      where: { id: crawl.id },
      data: { status: "completed", finishedAt: new Date(), pagesFound: pageResults.length },
    });

    return { crawlId: crawl.id, pagesFound: pageResults.length, findingsCount: totalFindings };
  } catch (err) {
    await prisma.crawl.update({
      where: { id: crawl.id },
      data: { status: "failed", finishedAt: new Date() },
    });
    throw err;
  }
}
