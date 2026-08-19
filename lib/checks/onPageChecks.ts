/**
 * On-page audit checks — implements Exact_Audit_Methodology.md Steps 1-4.
 *
 * These run against RAW HTML (not rendered DOM) per Step 1: "view actual
 * page source... since tools like SearchAtlas may not execute JavaScript."
 * This mirrors what a real crawler / search engine actually sees.
 */

import * as cheerio from "cheerio";

export type Priority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface RawFinding {
  category: "technical" | "local" | "content" | "schema" | "image" | "redirect";
  checkStep: string;
  title: string;
  description: string;
  fixType?: string;
  howToTest?: string;
  priority: Priority;
  owner?: "developer" | "content editor" | "local seo manager";
}

interface PageContext {
  url: string;
  statusCode: number;
  rawHtml: string;
  pageType: string; // homepage | service_page | blog_article | etc.
  allTitlesOnSite: Map<string, string[]>; // title -> [urls] for duplicate detection
}

// Exact_Audit_Methodology.md Step 4's table uses "/" for interchangeable
// schema types (e.g. "Organization/LocalBusiness", "BlogPosting/Article")
// — either one satisfies that requirement, they're not both mandatory.
// Each inner array here is one such alternatives group.
const EXPECTED_SCHEMA_BY_TYPE: Record<string, string[][]> = {
  homepage: [["Organization", "LocalBusiness"], ["WebSite"], ["BreadcrumbList"]],
  service_page: [["Service"], ["LocalBusiness", "Organization"], ["BreadcrumbList"]],
  blog_article: [["BlogPosting", "Article"], ["BreadcrumbList"]],
  product_page: [["Product"], ["Offer"]],
  about_page: [["AboutPage"], ["Organization", "LocalBusiness"]],
  contact_page: [["ContactPage"], ["LocalBusiness"]],
  collection_page: [["CollectionPage"], ["BreadcrumbList"]],
};

export function runStep1_RawHtmlChecks(ctx: PageContext): RawFinding[] {
  const findings: RawFinding[] = [];
  const $ = cheerio.load(ctx.rawHtml);

  // --- Title tag ---
  const titles = $("title");
  if (titles.length === 0) {
    findings.push({
      category: "technical",
      checkStep: "Step 1 - Raw HTML",
      title: "Missing <title> tag",
      description: "Page has no <title> in raw HTML. Search engines and browser tabs have nothing to display.",
      fixType: "Add a unique, descriptive <title> (50-60 chars) server-rendered in <head>.",
      howToTest: "View page source (Ctrl+U) and confirm exactly one <title> tag is present.",
      priority: "CRITICAL",
    });
  } else if (titles.length > 1) {
    findings.push({
      category: "technical",
      checkStep: "Step 1 - Raw HTML",
      title: "Duplicate <title> tags in raw HTML",
      description: "More than one <title> tag found — common Shopify failure mode when theme and an app both inject one.",
      fixType: "Remove the duplicate injection point (check theme.liquid vs. installed SEO apps).",
      howToTest: "View page source and confirm exactly one <title> tag.",
      priority: "HIGH",
    });
  } else {
    const titleText = titles.first().text().trim();
    const existing = ctx.allTitlesOnSite.get(titleText) || [];
    if (existing.length > 0 && !existing.includes(ctx.url)) {
      findings.push({
        category: "technical",
        checkStep: "Step 1 - Raw HTML",
        title: "Duplicate title across pages",
        description: `Title "${titleText}" is also used on: ${existing.join(", ")}`,
        fixType: "Write a unique title per page reflecting that page's specific intent.",
        howToTest: "Re-crawl and confirm no two URLs share a title.",
        priority: "HIGH",
      });
    }
  }

  // --- Meta description ---
  const metaDesc = $('meta[name="description"]');
  if (metaDesc.length === 0) {
    findings.push({
      category: "technical",
      checkStep: "Step 1 - Raw HTML",
      title: "Missing meta description",
      description: "No <meta name=\"description\"> found in raw HTML.",
      fixType: "Add a unique 140-160 character meta description server-rendered in <head>.",
      howToTest: "View page source and confirm the tag is present with content.",
      priority: "MEDIUM",
    });
  } else if (metaDesc.length > 1) {
    findings.push({
      category: "technical",
      checkStep: "Step 1 - Raw HTML",
      title: "Duplicate meta description tags",
      description: "Multiple meta description tags in raw HTML — likely theme + app conflict.",
      priority: "HIGH",
    });
  }

  // --- H1 ---
  const h1s = $("h1");
  if (h1s.length === 0) {
    findings.push({
      category: "content",
      checkStep: "Step 1 - Raw HTML",
      title: "Missing H1",
      description: "No H1 found in raw HTML. If one appears visually, it's being injected client-side, which search engines may not credit.",
      fixType: "Add a hardcoded H1 matching page intent, server-rendered.",
      priority: "HIGH",
    });
  } else if (h1s.length > 1) {
    findings.push({
      category: "content",
      checkStep: "Step 1 - Raw HTML",
      title: "Multiple H1 tags",
      description: `${h1s.length} H1 tags found. Should be exactly one per page.`,
      priority: "MEDIUM",
    });
  }

  // --- Canonical ---
  const canonical = $('link[rel="canonical"]');
  if (canonical.length === 0) {
    findings.push({
      category: "technical",
      checkStep: "Step 1 - Raw HTML",
      title: "Missing canonical tag",
      description: "No canonical tag present — risk of duplicate content being split across URL variants (http/https, www/non-www, trailing slash).",
      priority: "HIGH",
    });
  } else if (canonical.length > 1) {
    findings.push({
      category: "technical",
      checkStep: "Step 1 - Raw HTML",
      title: "Multiple canonical tags",
      description: "Conflicting canonical signals — search engines may ignore both.",
      priority: "HIGH",
    });
  }

  // --- Open Graph / Twitter ---
  const requiredOg = ["og:title", "og:description", "og:url", "og:type"];
  const missingOg = requiredOg.filter((tag) => $(`meta[property="${tag}"]`).length === 0);
  if (missingOg.length > 0) {
    findings.push({
      category: "technical",
      checkStep: "Step 1 - Raw HTML",
      title: "Incomplete Open Graph tags",
      description: `Missing: ${missingOg.join(", ")}. Affects how the page appears when shared on social platforms.`,
      priority: "LOW",
    });
  }

  // --- JSON-LD schema ---
  const schemaScripts = $('script[type="application/ld+json"]');
  const schemaTypes: string[] = [];
  schemaScripts.each((_, el) => {
    try {
      const parsed = JSON.parse($(el).text());
      const type = parsed["@type"];
      if (type) schemaTypes.push(...(Array.isArray(type) ? type : [type]));
    } catch {
      findings.push({
        category: "schema",
        checkStep: "Step 1 - Raw HTML",
        title: "Invalid JSON-LD syntax",
        description: "A schema block failed to parse as valid JSON — it will be ignored by search engines entirely.",
        priority: "HIGH",
      });
    }
  });

  const expectedGroups = EXPECTED_SCHEMA_BY_TYPE[ctx.pageType] || [];
  const missingGroups = expectedGroups.filter((group) => !group.some((t) => schemaTypes.includes(t)));
  if (missingGroups.length > 0) {
    const expectedLabel = expectedGroups.map((g) => g.join("/")).join(", ");
    findings.push({
      category: "schema",
      checkStep: "Step 4 - Schema by page type",
      title: `Missing expected schema for ${ctx.pageType}`,
      description: `Expected: ${expectedLabel}. Found: ${schemaTypes.join(", ") || "none"}.`,
      fixType: `Add ${missingGroups.map((g) => g.join("/")).join(", ")} JSON-LD with stable @id values.`,
      priority: "MEDIUM",
    });
  }

  // Duplicate schema types (theme + app both firing — common Shopify issue)
  const typeCounts = schemaTypes.reduce<Record<string, number>>((acc, t) => {
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});
  Object.entries(typeCounts).forEach(([type, count]) => {
    if (count > 1) {
      findings.push({
        category: "schema",
        checkStep: "Step 4 - Schema by page type",
        title: `Duplicate ${type} schema`,
        description: `${type} schema appears ${count} times — likely theme + app both injecting it.`,
        fixType: "Remove one source; keep a single authoritative block per type.",
        priority: "MEDIUM",
      });
    }
  });

  return findings;
}

export function runStep2_IndexabilityChecks(ctx: PageContext): RawFinding[] {
  const findings: RawFinding[] = [];
  const $ = cheerio.load(ctx.rawHtml);

  if (ctx.statusCode >= 400) {
    findings.push({
      category: "technical",
      checkStep: "Step 2 - Indexability",
      title: `Page returns ${ctx.statusCode}`,
      description: "Broken page — blocks crawling and any internal links pointing here.",
      priority: "CRITICAL",
    });
  }

  const robotsMeta = $('meta[name="robots"]').attr("content") || "";
  if (robotsMeta.includes("noindex") && ctx.pageType !== "search_page") {
    findings.push({
      category: "technical",
      checkStep: "Step 2 - Indexability",
      title: "Page is noindex",
      description: "This page is set to noindex. Confirm this is intentional — a page meant to rank should not carry this tag.",
      priority: "CRITICAL",
    });
  }

  return findings;
}

export function runAllChecks(ctx: PageContext): RawFinding[] {
  // A non-2xx response (rate-limited, server error, etc.) usually means
  // rawHtml is an error/challenge page, not the real page — running the
  // content checks against it produces noise ("missing title/canonical/OG")
  // that isn't a real finding about the page. Step 2 already reports the
  // bad status itself, which is the actual issue.
  const isSuccessResponse = ctx.statusCode >= 200 && ctx.statusCode < 300;
  return [
    ...(isSuccessResponse ? runStep1_RawHtmlChecks(ctx) : []),
    ...runStep2_IndexabilityChecks(ctx),
  ];
}
