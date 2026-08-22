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
import { createHash } from "crypto";
import { PrismaClient } from "@prisma/client";
import { runAllChecks, type RawFinding } from "../checks/onPageChecks";
import { runLocalSeoChecks } from "../localSeo/runLocalSeoAudit";
import { runRenderComparisonChecks } from "../checks/renderComparisonChecks";
import {
  runRedirectChainChecks,
  runXRobotsTagCheck,
  runDuplicateMetaDescriptionCheck,
  runThinContentCheck,
  runCanonicalConsistencyCheck,
} from "../checks/technicalSeoChecks";
import { withRenderer } from "./render";
import { fetchWithRedirects, type FetchResult } from "./fetchWithRedirects";
import { createFindingRecord } from "../findings/createFinding";
import { extractInternalLinks } from "./extractLinks";
import { analyzeLinkGraph, runInternalLinkFindings } from "../checks/internalLinkGraph";
import { runSchemaRequiredPropertiesCheck, extractLocalBusinessId, runLocalBusinessIdConsistencyCheck, detectSchemaGaps, runSystemicSchemaGapCheck, runSchemaUrlConsistencyCheck, type SchemaGap } from "../checks/schemaValidation";
import { detectRegressions } from "../checks/regressionDetection";
import { ReconciliationTracker } from "../findings/autoResolveFixedFindings";

const prisma = new PrismaClient();

const USER_AGENT = "OmniSEOBot/1.0 (+internal audit tool for omnicenters.com)";
const MAX_PAGES = 200; // safety ceiling for v1 (single domain)

// Legal, transactional, and directory/admin pages under /pages/ that the
// generic "everything under /pages/ is a service page" rule below would
// otherwise misclassify. Real bug this fixes: found live during an
// accuracy audit -- pages like /pages/privacy-policy and
// /pages/terms-of-use were classified as service_page, so the content-
// quality LLM review (which expects service/treatment content) ran
// against them and produced findings the LLM's own output described as
// "Not applicable -- privacy policy...", and the internal-link-graph
// "important page" check flagged them as under-linked money pages.
// Neither check is meaningful for a legal or confirmation page.
const UTILITY_PAGE_SLUG_RE = /\/pages\/(privacy-policy|terms-of-use|terms-and-conditions|terms-of-service|cookie-policy|accessibility-statement|refund-policy|shipping-policy|thank-you|appointment-confirmed|order-confirmed|booking-confirmed|covid-19-information|online-booking|[a-z-]*online-profiles)/i;

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
  if (UTILITY_PAGE_SLUG_RE.test(path)) return "utility_page";
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
    const res = await fetch(`${origin}/robots.txt`, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(15_000) });
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
    const res = await fetch(`${origin}/sitemap.xml`, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return [];
    const xml = await res.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    const urls: string[] = [];
    $("loc").each((_, el) => { urls.push($(el).text().trim()); });
    // Handle sitemap index files (one level deep). Check the pathname, not
    // the raw URL string — Shopify's dynamic sub-sitemaps (e.g. the pages
    // sitemap) carry a query string like "?from=...&to=...", so a naive
    // u.endsWith(".xml") misses them entirely and silently drops every
    // page inside that sub-sitemap from discovery.
    const isXmlSitemap = (u: string) => {
      try {
        return new URL(u).pathname.endsWith(".xml");
      } catch {
        return false;
      }
    };
    const subSitemaps = urls.filter(isXmlSitemap);
    const directUrls = urls.filter((u) => !isXmlSitemap(u));
    for (const sub of subSitemaps.slice(0, 10)) {
      try {
        const subRes = await fetch(sub, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(15_000) });
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
    const allMetaDescsOnSite = new Map<string, string[]>();
    const pageResults: {
      url: string;
      html: string;
      renderedHtml: string | null;
      status: number;
      pageType: string;
      fetchResult: FetchResult;
    }[] = [];

    // First pass: fetch all pages (following redirects manually so the
    // chain is visible, not hidden by fetch()'s auto-follow) and render
    // each one (rendered DOM) through a single shared headless-browser
    // instance. A delay between requests keeps a same-domain, 50-200 page
    // crawl from tripping the target's own rate limiter and getting back
    // error pages that would otherwise look like real findings.
    await withRenderer(async (renderPage) => {
      for (const url of urls) {
        const fetchResult = await fetchWithRedirects(url);
        const { html, finalStatus: status } = fetchResult;

        if (html) {
          const $ = cheerio.load(html);
          const title = $("title").first().text().trim();
          if (title) {
            const existing = allTitlesOnSite.get(title) || [];
            existing.push(url);
            allTitlesOnSite.set(title, existing);
          }
          const metaDesc = $('meta[name="description"]').attr("content")?.trim();
          if (metaDesc) {
            const existing = allMetaDescsOnSite.get(metaDesc) || [];
            existing.push(url);
            allMetaDescsOnSite.set(metaDesc, existing);
          }
        }

        const renderedHtml = status >= 200 && status < 300 ? await renderPage(url) : null;
        pageResults.push({ url, html, renderedHtml, status, pageType: classifyPageType(url), fetchResult });
        await new Promise((r) => setTimeout(r, 350));
      }
    });

    // Second pass: run checks now that we have sitewide title/meta data for
    // duplicate detection
    let totalFindings = 0;
    const tracker = new ReconciliationTracker();
    let homepage: { pageId: string; html: string; url: string } | null = null;
    const allLinks: { sourceUrl: string; targetUrl: string; anchorText: string | null; isContextual: boolean }[] = [];
    const urlToPageId = new Map<string, string>();
    const pagesWithCanonicals: { url: string; canonical: string }[] = [];
    const pagesWithLocalBusinessIds: { url: string; id: string | null; hasLocalBusinessSchema: boolean }[] = [];
    const pagesWithSchemaGaps: { url: string; gaps: SchemaGap[] }[] = [];
    const pagesForSchemaUrlCheck: { url: string; finalUrl: string; rawHtml: string }[] = [];

    for (const { url, html, renderedHtml, status, pageType, fetchResult } of pageResults) {
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

      if (html) {
        const snapshotSchemaTypes: string[] = [];
        $('script[type="application/ld+json"]').each((_, el) => {
          try {
            const parsed = JSON.parse($(el).text());
            const type = parsed["@type"];
            if (type) snapshotSchemaTypes.push(...(Array.isArray(type) ? type : [type]));
          } catch {
            /* invalid JSON-LD already flagged elsewhere */
          }
        });

        const snapshotFields = {
          statusCode: page.statusCode,
          title: page.title,
          metaDesc: page.metaDesc,
          canonical: page.canonical,
          h1: page.h1,
          schemaTypes: snapshotSchemaTypes,
        };

        await prisma.pageSnapshot.upsert({
          where: { crawlId_pageId: { crawlId: crawl.id, pageId: page.id } },
          update: { rawHtml: html, rawHtmlHash: createHash("sha256").update(html).digest("hex"), renderedHtml, ...snapshotFields },
          create: {
            crawlId: crawl.id,
            pageId: page.id,
            rawHtml: html,
            rawHtmlHash: createHash("sha256").update(html).digest("hex"),
            renderedHtml,
            ...snapshotFields,
          },
        });
      }

      if (pageType === "homepage") homepage = { pageId: page.id, html, url };
      urlToPageId.set(url, page.id);

      const canonical = $('link[rel="canonical"]').attr("href")?.trim();
      if (canonical) pagesWithCanonicals.push({ url, canonical });

      if (html) {
        for (const link of extractInternalLinks(html, url)) {
          allLinks.push({ sourceUrl: url, ...link });
        }
      }

      const findings: RawFinding[] = runAllChecks({
        url,
        statusCode: status,
        rawHtml: html,
        pageType,
        allTitlesOnSite,
      });
      tracker.markEvaluated(page.id, "Step 1 - Raw HTML");
      tracker.markEvaluated(page.id, "Step 2 - Indexability");
      tracker.markEvaluated(page.id, "Step 4 - Schema by page type");

      findings.push(...runRedirectChainChecks(url, fetchResult));
      tracker.markEvaluated(page.id, "Technical SEO Engine - Redirects");
      findings.push(...runXRobotsTagCheck(url, fetchResult.xRobotsTag));
      tracker.markEvaluated(page.id, "Technical SEO Engine - Indexability");
      if (html) {
        const metaDesc = $('meta[name="description"]').attr("content")?.trim() ?? null;
        findings.push(...runDuplicateMetaDescriptionCheck(url, metaDesc, allMetaDescsOnSite));
        tracker.markEvaluated(page.id, "Technical SEO Engine - Duplicate Content");
        findings.push(...runThinContentCheck(url, html, pageType));
        tracker.markEvaluated(page.id, "Technical SEO Engine - Content Depth");
        findings.push(...runSchemaRequiredPropertiesCheck(html));
        tracker.markEvaluated(page.id, "Schema Validation - Required Properties");
        const localBusinessId = extractLocalBusinessId(html);
        pagesWithLocalBusinessIds.push({ url, id: localBusinessId, hasLocalBusinessSchema: localBusinessId !== null });
        pagesWithSchemaGaps.push({ url, gaps: detectSchemaGaps(html) });
        pagesForSchemaUrlCheck.push({ url, finalUrl: fetchResult.finalUrl, rawHtml: html });
      }
      if (renderedHtml) {
        findings.push(...runRenderComparisonChecks(html, renderedHtml));
        tracker.markEvaluated(page.id, "Rendered DOM Comparison");
      }

      for (const f of findings) {
        await createFindingRecord(crawl.id, page.id, f);
        tracker.markCreated({ pageId: page.id, category: f.category, checkStep: f.checkStep, title: f.title });
        totalFindings++;
      }
    }

    // Sitewide canonical URL pattern consistency (protocol/www) — needs
    // every page's canonical before it can tell what the dominant pattern is.
    for (const { url: pUrl } of pagesWithCanonicals) {
      tracker.markEvaluated(urlToPageId.get(pUrl) ?? null, "Technical SEO Engine - URL Consistency");
    }
    for (const { url, finding } of runCanonicalConsistencyCheck(pagesWithCanonicals)) {
      const pageId = urlToPageId.get(url) ?? null;
      await createFindingRecord(crawl.id, pageId, finding);
      tracker.markCreated({ pageId, category: finding.category, checkStep: finding.checkStep, title: finding.title });
      totalFindings++;
    }

    // Sitewide LocalBusiness/Organization @id consistency — same reasoning
    // as canonical consistency: needs every page's entity @id before it
    // can tell which one is the dominant, correct one.
    for (const { url: pUrl } of pagesWithLocalBusinessIds) {
      tracker.markEvaluated(urlToPageId.get(pUrl) ?? null, "Schema Validation - Entity Consistency");
    }
    for (const { url, finding } of runLocalBusinessIdConsistencyCheck(pagesWithLocalBusinessIds)) {
      const pageId = urlToPageId.get(url) ?? null;
      await createFindingRecord(crawl.id, pageId, finding);
      tracker.markCreated({ pageId, category: finding.category, checkStep: finding.checkStep, title: finding.title });
      totalFindings++;
    }

    // Sitewide schema URL consistency — a page's own url/mainEntityOfPage
    // schema property should point back at that same page's real,
    // current URL, not a stale pre-redirect one.
    for (const { url: pUrl } of pagesForSchemaUrlCheck) {
      tracker.markEvaluated(urlToPageId.get(pUrl) ?? null, "Schema Validation - URL Consistency");
    }
    for (const { url, finding } of runSchemaUrlConsistencyCheck(pagesForSchemaUrlCheck)) {
      const pageId = urlToPageId.get(url) ?? null;
      await createFindingRecord(crawl.id, pageId, finding);
      tracker.markCreated({ pageId, category: finding.category, checkStep: finding.checkStep, title: finding.title });
      totalFindings++;
    }

    // Sitewide schema gap pattern detection — attached to the homepage
    // since it's a site-level issue (one shared template), not any single
    // page's problem, same reasoning as the Local SEO NAP check.
    tracker.markEvaluated(homepage?.pageId ?? null, "Schema Validation - Systemic Gap");
    for (const finding of runSystemicSchemaGapCheck(pagesWithSchemaGaps)) {
      await createFindingRecord(crawl.id, homepage?.pageId ?? null, finding);
      tracker.markCreated({ pageId: homepage?.pageId ?? null, category: finding.category, checkStep: finding.checkStep, title: finding.title });
      totalFindings++;
    }

    // Internal Link Graph — bulk-store every link found this crawl, then
    // analyze orphans/depth/authority/under-linked money pages. Needs the
    // full link set and page list, so it runs once after the main loop.
    if (allLinks.length > 0) {
      await prisma.internalLink.createMany({
        data: allLinks.map((l) => ({ crawlId: crawl.id, siteId, ...l })),
      });
    }
    if (homepage) {
      const { stats } = analyzeLinkGraph({
        homepageUrl: homepage.url,
        pages: pageResults.map((p) => ({ url: p.url, pageType: p.pageType })),
        links: allLinks,
      });
      for (const p of pageResults) {
        tracker.markEvaluated(urlToPageId.get(p.url) ?? null, "Internal Link Graph");
      }
      for (const { url, finding } of runInternalLinkFindings(stats)) {
        const pageId = urlToPageId.get(url) ?? null;
        await createFindingRecord(crawl.id, pageId, finding);
        tracker.markCreated({ pageId, category: finding.category, checkStep: finding.checkStep, title: finding.title });
        totalFindings++;
      }
    }

    // Sitewide Step 5 Local SEO check — NAP consistency across footer,
    // schema, and the cached GBP public listing. Runs once against the
    // homepage rather than per page.
    if (homepage) {
      tracker.markEvaluated(homepage.pageId, "Step 5 - Local SEO");
      const localFindings = await runLocalSeoChecks(siteId, homepage.html);
      for (const f of localFindings) {
        await createFindingRecord(crawl.id, homepage.pageId, f);
        tracker.markCreated({ pageId: homepage.pageId, category: f.category, checkStep: f.checkStep, title: f.title });
        totalFindings++;
      }
    }

    // Regression detection — diffs this crawl's snapshots against the
    // site's previous crawl. Runs last since it needs every snapshot
    // from this crawl already written.
    for (const p of pageResults) {
      tracker.markEvaluated(urlToPageId.get(p.url) ?? null, "Regression Detection");
    }
    for (const { url, finding } of await detectRegressions(siteId, crawl.id)) {
      const pageId = urlToPageId.get(url) ?? null;
      await createFindingRecord(crawl.id, pageId, finding);
      tracker.markCreated({ pageId, category: finding.category, checkStep: finding.checkStep, title: finding.title });
      totalFindings++;
    }

    // Complement to the crawl's own detection: any PENDING finding for a
    // (page, checkStep) pair that was genuinely re-evaluated this crawl,
    // and did NOT get recreated, means the underlying issue is actually
    // gone -- mark it resolved instead of leaving it stuck open forever.
    // Deliberately excludes findings from separately-scripted checks
    // (Content Depth LLM Review, AI Search Readiness, Core Web Vitals)
    // since those weren't re-run by this crawl at all.
    await tracker.resolveFixedFindings(siteId);

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
