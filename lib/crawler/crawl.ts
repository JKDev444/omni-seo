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
import { runLocalSeoChecks } from "../localSeo/runLocalSeoAudit";

const prisma = new PrismaClient();

const USER_AGENT = "OmniSEOBot/1.0 (+internal audit tool for omnicenters.com)";
const MAX_PAGES = 200; // safety ceiling for v1 (single domain)

function classifyPageType(url: string): string {
  const path = new URL(url).pathname;
  const segments = path.split("/").filter(Boolean);
  if (path === "/") return "homepage";
  if (segments[0] === "blogs" || segments[0] === "blog") {
    // /blogs/<handle> is the index/listing page for that blog — it's a
    // collection of articles, not an article itself. Only
    // /blogs/<handle>/<article-handle> (3+ segments) is a real article.
    return segments.length >= 3 ? "blog_article" : "collection_page";
  }
  if (path.includes("/products/")) return "product_page";
  if (path.includes("/collections/")) return "collection_page";
  if (path.includes("/pages/about")) return "about_page";
  if (path.includes("/pages/contact")) return "contact_page";
  if (path.includes("/pages/")) return "service_page"; // most Shopify content pages
  return "other";
}

// Sitemaps sometimes list non-HTML resources (sitemap index fragments,
// static text/markdown files, etc.) alongside real pages. Auditing those
// as if they were pages produces meaningless "missing title/meta" noise.
const NON_PAGE_EXTENSION_RE = /\.(xml|txt|md|json|pdf|jpg|jpeg|png|gif|svg|webp|css|js|ico|xsl)$/i;

function isCrawlablePage(url: string): boolean {
  return !NON_PAGE_EXTENSION_RE.test(new URL(url).pathname);
}

interface RobotsRule {
  type: "allow" | "disallow";
  pattern: string;
}

// Real robots.txt files scope rules per User-agent block (our own bot name,
// "*" for everyone else, or specific bots like Nutch/AhrefsBot). A naive
// parser that globs every Disallow line regardless of which block it's
// under will pick up rules meant for a completely different crawler —
// e.g. a site blocking Nutch with "Disallow: /" would silently block us
// too. This groups rules by user-agent and only applies the group that
// actually matches OmniSEOBot (falling back to "*").
function parseRobotsGroups(text: string): Map<string, RobotsRule[]> {
  const groups = new Map<string, RobotsRule[]>();
  let currentAgents: string[] = [];
  let sawRuleSinceLastAgent = false;

  for (const rawLine of text.split("\n")) {
    const line = rawLine.split("#")[0].trim();
    if (!line) continue;

    const agentMatch = line.match(/^User-agent:\s*(.+)$/i);
    if (agentMatch) {
      const agent = agentMatch[1].trim().toLowerCase();
      if (sawRuleSinceLastAgent) currentAgents = []; // new block starting
      currentAgents.push(agent);
      if (!groups.has(agent)) groups.set(agent, []);
      sawRuleSinceLastAgent = false;
      continue;
    }

    const ruleMatch = line.match(/^(Allow|Disallow):\s*(\S*)$/i);
    if (ruleMatch && currentAgents.length > 0) {
      const type = ruleMatch[1].toLowerCase() as "allow" | "disallow";
      const pattern = ruleMatch[2];
      sawRuleSinceLastAgent = true;
      for (const agent of currentAgents) {
        groups.get(agent)!.push({ type, pattern });
      }
    }
  }

  return groups;
}

function robotsPatternToRegExp(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const escaped = body
    .split("*")
    .map((seg) => seg.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${escaped}${anchored ? "$" : ""}`);
}

/** Returns a predicate for whether OmniSEOBot may fetch a given path+query. */
async function fetchRobotsAllowedPaths(origin: string): Promise<(pathAndQuery: string) => boolean> {
  const allowAll = () => true;
  try {
    const res = await fetch(`${origin}/robots.txt`, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return allowAll;
    const text = await res.text();
    const groups = parseRobotsGroups(text);

    const ourAgent = "omniseobot";
    const rules = groups.get(ourAgent) ?? groups.get("*") ?? [];
    if (rules.length === 0) return allowAll;

    const compiled = rules.map((r) => ({ type: r.type, re: robotsPatternToRegExp(r.pattern) }));

    return (pathAndQuery: string) => {
      // Longest-matching-pattern wins, per the robots.txt spec.
      let winner: RobotsRule["type"] | null = null;
      let winnerLen = -1;
      for (let i = 0; i < compiled.length; i++) {
        const rule = rules[i];
        if (rule.pattern === "") continue; // "Disallow:" with no path = allow everything
        if (compiled[i].re.test(pathAndQuery) && rule.pattern.length > winnerLen) {
          winner = rule.type;
          winnerLen = rule.pattern.length;
        }
      }
      return winner !== "disallow";
    };
  } catch {
    // no robots.txt — proceed, nothing explicitly disallowed
    return allowAll;
  }
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
    const isAllowedByRobots = await fetchRobotsAllowedPaths(origin);
    let urls = await fetchSitemapUrls(origin);

    if (urls.length === 0) {
      // Fallback per Step 0: sample the homepage + discover links from it
      urls = [origin];
    } else if (!urls.some((u) => new URL(u).pathname === "/")) {
      // Most CMS sitemaps (Shopify included) list collections/products/pages
      // but omit the homepage itself. It must always be crawled — it's the
      // page the Step 5 NAP check runs against.
      urls = [origin, ...urls];
    }

    urls = urls
      .filter(isCrawlablePage)
      .filter((u) => {
        const parsed = new URL(u);
        return isAllowedByRobots(parsed.pathname + parsed.search);
      })
      .slice(0, MAX_PAGES);

    const allTitlesOnSite = new Map<string, string[]>();
    const pageResults: { url: string; html: string; status: number; pageType: string }[] = [];

    // First pass: fetch all pages. A delay between requests plus retries
    // with growing backoff on 429/503 keeps a same-domain, 50-200 page
    // crawl from tripping the target's own rate limiter and getting back
    // error pages that would otherwise look like real findings.
    const RETRY_BACKOFFS_MS = [3000, 6000, 12000];
    for (const url of urls) {
      try {
        let res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
        for (const fallbackBackoffMs of RETRY_BACKOFFS_MS) {
          if (res.status !== 429 && res.status !== 503) break;
          const retryAfterHeader = Number(res.headers.get("retry-after"));
          const backoffMs = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0 ? retryAfterHeader * 1000 : fallbackBackoffMs;
          await new Promise((r) => setTimeout(r, backoffMs));
          res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
        }
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
      await new Promise((r) => setTimeout(r, 350));
    }

    // Second pass: run checks now that we have sitewide title data for duplicate detection
    let totalFindings = 0;
    let homepage: { pageId: string; html: string } | null = null;
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

      if (pageType === "homepage") homepage = { pageId: page.id, html };

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
            owner: f.owner,
            status: "PENDING",
          },
        });
        totalFindings++;
      }
    }

    // Sitewide Step 5 Local SEO check — NAP consistency across footer,
    // schema, and the cached GBP public listing. Runs once against the
    // homepage rather than per page.
    if (homepage) {
      const localFindings = await runLocalSeoChecks(siteId, homepage.html);
      for (const f of localFindings) {
        await prisma.finding.create({
          data: {
            crawlId: crawl.id,
            pageId: homepage.pageId,
            category: f.category,
            checkStep: f.checkStep,
            title: f.title,
            description: f.description,
            fixType: f.fixType,
            howToTest: f.howToTest,
            priority: f.priority,
            owner: f.owner,
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
