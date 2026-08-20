/**
 * The "Screaming Frog / Ahrefs Site Audit" layer — checks that need
 * either the redirect chain (not visible to a plain fetch that
 * auto-follows) or sitewide context across every crawled page, as
 * opposed to onPageChecks.ts's single-page raw-HTML checks.
 */
import * as cheerio from "cheerio";
import type { RawFinding } from "./onPageChecks";
import type { FetchResult } from "../crawler/fetchWithRedirects";
import { extractVisibleText } from "./contentDepthChecks";

export function runRedirectChainChecks(startUrl: string, result: FetchResult): RawFinding[] {
  const findings: RawFinding[] = [];

  if (result.loop) {
    findings.push({
      category: "redirect",
      checkStep: "Technical SEO Engine - Redirects",
      title: "Redirect loop",
      description: `${startUrl} redirects back to a URL already visited in the same chain: ${result.chain.map((h) => h.url).join(" -> ")}`,
      fixType: "Fix the redirect rule creating the loop — trace each hop and point it directly at the final destination.",
      priority: "CRITICAL",
      fixLocation: "Shopify Admin > Redirects",
    });
    return findings;
  }

  if (result.tooManyRedirects) {
    findings.push({
      category: "redirect",
      checkStep: "Technical SEO Engine - Redirects",
      title: "Too many redirects",
      description: `${startUrl} did not resolve within 10 redirect hops.`,
      priority: "CRITICAL",
      fixLocation: "Shopify Admin > Redirects",
    });
    return findings;
  }

  const hopCount = result.chain.length - 1; // hops before reaching the final response
  if (hopCount >= 1) {
    const chainDescription = result.chain.map((h) => `${h.url} (${h.status || "error"})`).join(" -> ");
    findings.push({
      category: "redirect",
      checkStep: "Technical SEO Engine - Redirects",
      title: hopCount === 1 ? "Sitemap URL redirects instead of returning 200 directly" : "Redirect chain",
      description: `${startUrl} takes ${hopCount} redirect hop(s) to reach its final destination: ${chainDescription}. Sitemaps and internal links should point directly at the final 200 URL.`,
      fixType: "Update the sitemap entry (and any internal links) to point directly at the final destination URL.",
      priority: hopCount >= 2 ? "HIGH" : "MEDIUM",
      confidence: 100,
      fixLocation: "Shopify Admin > Redirects",
    });
  }

  if (result.finalStatus >= 400) {
    findings.push({
      category: "redirect",
      checkStep: "Technical SEO Engine - Redirects",
      title: `Sitemap URL leads to ${result.finalStatus}`,
      description: `${startUrl} ultimately resolves to a ${result.finalStatus} response${hopCount >= 1 ? ` after ${hopCount} redirect hop(s)` : ""}.`,
      priority: "CRITICAL",
    });
  }

  return findings;
}

export function runXRobotsTagCheck(url: string, xRobotsTag: string | null): RawFinding[] {
  if (!xRobotsTag) return [];
  if (!xRobotsTag.toLowerCase().includes("noindex")) return [];
  return [
    {
      category: "technical",
      checkStep: "Technical SEO Engine - Indexability",
      title: "X-Robots-Tag: noindex header",
      description: `The HTTP response for ${url} carries an X-Robots-Tag header with "noindex" — this blocks indexing even if the page's meta robots tag looks fine, and is easy to miss since it's not visible in page source.`,
      fixType: "Confirm this is intentional. If not, remove the X-Robots-Tag header (check CDN/hosting config, not just the theme).",
      priority: "CRITICAL",
      fixLocation: "DNS",
    },
  ];
}

/** Sitewide duplicate meta description detection — mirrors the existing duplicate-title check. */
export function runDuplicateMetaDescriptionCheck(
  url: string,
  metaDesc: string | null,
  allMetaDescsOnSite: Map<string, string[]>
): RawFinding[] {
  if (!metaDesc) return [];
  const existing = allMetaDescsOnSite.get(metaDesc) || [];
  if (existing.length > 0 && !existing.includes(url)) {
    return [
      {
        category: "technical",
        checkStep: "Technical SEO Engine - Duplicate Content",
        title: "Duplicate meta description across pages",
        description: `Meta description is also used on: ${existing.join(", ")}`,
        fixType: "Write a unique meta description per page.",
        priority: "MEDIUM",
        fixLocation: "Shopify Admin > Page",
      },
    ];
  }
  return [];
}

/** Word count under this is flagged as thin — a heuristic, not a hard rule. */
const THIN_CONTENT_WORD_THRESHOLD = 150;

export function runThinContentCheck(url: string, rawHtml: string, pageType: string): RawFinding[] {
  // Utility/system page types aren't expected to carry much body copy.
  if (pageType === "contact_page" || pageType === "collection_page") return [];

  const text = extractVisibleText(rawHtml);
  const wordCount = text ? text.split(" ").length : 0;

  if (wordCount < THIN_CONTENT_WORD_THRESHOLD) {
    return [
      {
        category: "content",
        checkStep: "Technical SEO Engine - Content Depth",
        title: "Thin content",
        description: `Roughly ${wordCount} words of visible body text — below the ${THIN_CONTENT_WORD_THRESHOLD}-word heuristic threshold for pages meant to rank.`,
        fixType: "Expand with genuinely useful content (process, benefits, FAQs, local context) — not padding for its own sake.",
        priority: "MEDIUM",
        confidence: 60, // word count alone doesn't capture whether a short page is legitimately fine
        fixLocation: "Content rewrite",
      },
    ];
  }
  return [];
}

interface CanonicalUrlParts {
  protocol: string;
  hostPattern: "www" | "non-www";
  trailingSlash: boolean;
}

function parseCanonical(canonical: string): CanonicalUrlParts | null {
  try {
    const u = new URL(canonical);
    return {
      protocol: u.protocol,
      hostPattern: u.hostname.startsWith("www.") ? "www" : "non-www",
      trailingSlash: u.pathname.endsWith("/") && u.pathname !== "/",
    };
  } catch {
    return null;
  }
}

/**
 * Sitewide canonical URL pattern consistency — flags pages whose canonical
 * doesn't match the dominant protocol/www/trailing-slash pattern used
 * everywhere else on the site.
 */
export interface PageFinding {
  url: string;
  finding: RawFinding;
}

export function runCanonicalConsistencyCheck(
  pagesWithCanonicals: { url: string; canonical: string }[]
): PageFinding[] {
  const parsed = pagesWithCanonicals
    .map((p) => ({ ...p, parts: parseCanonical(p.canonical) }))
    .filter((p): p is { url: string; canonical: string; parts: CanonicalUrlParts } => p.parts !== null);

  if (parsed.length < 3) return []; // not enough data to establish a dominant pattern

  const count = <K extends string>(items: K[]): K =>
    Object.entries(
      items.reduce<Record<string, number>>((acc, v) => {
        acc[v] = (acc[v] ?? 0) + 1;
        return acc;
      }, {})
    ).sort((a, b) => b[1] - a[1])[0][0] as K;

  const dominantHostPattern = count(parsed.map((p) => p.parts.hostPattern));
  const dominantProtocol = count(parsed.map((p) => p.parts.protocol));

  const findings: PageFinding[] = [];
  for (const p of parsed) {
    if (p.parts.hostPattern !== dominantHostPattern) {
      findings.push({
        url: p.url,
        finding: {
          category: "technical",
          checkStep: "Technical SEO Engine - URL Consistency",
          title: `Canonical uses ${p.parts.hostPattern} while the rest of the site uses ${dominantHostPattern}`,
          description: `${p.url} has canonical "${p.canonical}" — inconsistent host pattern risks the exact duplicate-content split canonicals exist to prevent.`,
          priority: "HIGH",
          fixLocation: "Theme Liquid",
        },
      });
    }
    if (p.parts.protocol !== dominantProtocol) {
      findings.push({
        url: p.url,
        finding: {
          category: "technical",
          checkStep: "Technical SEO Engine - URL Consistency",
          title: `Canonical uses ${p.parts.protocol} while the rest of the site uses ${dominantProtocol}`,
          description: `${p.url} has canonical "${p.canonical}".`,
          priority: "HIGH",
          fixLocation: "Theme Liquid",
        },
      });
    }
  }
  return findings;
}
