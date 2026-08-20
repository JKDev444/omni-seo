/**
 * Extracts internal (same-domain) links from raw HTML, classifying each
 * as contextual (in the page's actual content) vs. navigational (nav/
 * header/footer chrome that appears on every page and doesn't signal
 * "this specific page endorses this specific link" the way body content
 * does). External links, mailto:/tel:/javascript: links, and same-page
 * anchors are excluded — this is specifically for the internal link
 * graph.
 */
import * as cheerio from "cheerio";

export interface ExtractedLink {
  targetUrl: string;
  anchorText: string | null;
  isContextual: boolean;
}

function normalizeUrl(raw: string, base: string): string | null {
  try {
    const u = new URL(raw, base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

export function extractInternalLinks(rawHtml: string, pageUrl: string): ExtractedLink[] {
  const $ = cheerio.load(rawHtml);
  const pageOrigin = new URL(pageUrl).origin;
  const links: ExtractedLink[] = [];
  const seen = new Set<string>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;

    const targetUrl = normalizeUrl(href, pageUrl);
    if (!targetUrl) return;
    if (new URL(targetUrl).origin !== pageOrigin) return; // external — not tracked here
    if (targetUrl === pageUrl) return; // self-link, not useful signal

    const isNav = $(el).parents("nav, header, footer").length > 0;
    const anchorText = $(el).text().trim().slice(0, 200) || null;

    // Same link can appear multiple times on one page (e.g. a card image
    // + card title both linking to the same product) — count it once per
    // page, keeping the most informative (contextual) classification.
    const dedupeKey = targetUrl;
    if (seen.has(dedupeKey)) {
      const existing = links.find((l) => l.targetUrl === targetUrl);
      if (existing && existing.isContextual === false && !isNav) existing.isContextual = true;
      return;
    }
    seen.add(dedupeKey);
    links.push({ targetUrl, anchorText, isContextual: !isNav });
  });

  return links;
}
