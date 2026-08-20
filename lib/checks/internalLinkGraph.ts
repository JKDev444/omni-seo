import type { RawFinding } from "./onPageChecks";

export interface LinkGraphInput {
  homepageUrl: string;
  pages: { url: string; pageType: string }[];
  links: { sourceUrl: string; targetUrl: string; isContextual: boolean }[];
}

export interface PageLinkStats {
  url: string;
  pageType: string;
  inboundTotal: number;
  inboundContextual: number;
  outboundTotal: number;
  depth: number | null; // BFS hops from homepage; null = unreachable via any tracked link
  isOrphan: boolean; // zero inbound links at all (not just contextual) — genuinely undiscoverable via internal links
  authorityScore: number; // 0-100, normalized against the site's highest contextual-inbound count
}

export interface LinkSuggestion {
  targetUrl: string;
  suggestedSources: string[];
}

// Money-page types worth holding to a higher internal-linking bar.
const IMPORTANT_PAGE_TYPES = new Set(["service_page", "product_page"]);
const MIN_CONTEXTUAL_LINKS_FOR_IMPORTANT_PAGES = 2;

function computeDepths(homepageUrl: string, adjacency: Map<string, Set<string>>): Map<string, number> {
  const depths = new Map<string, number>([[homepageUrl, 0]]);
  const queue = [homepageUrl];
  let head = 0;
  while (head < queue.length) {
    const current = queue[head++];
    const currentDepth = depths.get(current)!;
    for (const next of adjacency.get(current) ?? []) {
      if (!depths.has(next)) {
        depths.set(next, currentDepth + 1);
        queue.push(next);
      }
    }
  }
  return depths;
}

export function analyzeLinkGraph(input: LinkGraphInput): { stats: PageLinkStats[]; suggestions: LinkSuggestion[] } {
  const { homepageUrl, pages, links } = input;
  const pageUrls = new Set(pages.map((p) => p.url));

  const adjacency = new Map<string, Set<string>>();
  const inboundTotal = new Map<string, number>();
  const inboundContextual = new Map<string, number>();
  const outboundTotal = new Map<string, number>();
  const linkedFrom = new Map<string, Set<string>>(); // targetUrl -> set of sourceUrls that link to it

  for (const link of links) {
    if (!pageUrls.has(link.targetUrl)) continue; // only count links to pages we actually crawled

    if (!adjacency.has(link.sourceUrl)) adjacency.set(link.sourceUrl, new Set());
    adjacency.get(link.sourceUrl)!.add(link.targetUrl);

    inboundTotal.set(link.targetUrl, (inboundTotal.get(link.targetUrl) ?? 0) + 1);
    if (link.isContextual) inboundContextual.set(link.targetUrl, (inboundContextual.get(link.targetUrl) ?? 0) + 1);
    outboundTotal.set(link.sourceUrl, (outboundTotal.get(link.sourceUrl) ?? 0) + 1);

    if (!linkedFrom.has(link.targetUrl)) linkedFrom.set(link.targetUrl, new Set());
    linkedFrom.get(link.targetUrl)!.add(link.sourceUrl);
  }

  const depths = computeDepths(homepageUrl, adjacency);
  const maxContextual = Math.max(1, ...pages.map((p) => inboundContextual.get(p.url) ?? 0));

  const stats: PageLinkStats[] = pages.map((p) => {
    const total = inboundTotal.get(p.url) ?? 0;
    const contextual = inboundContextual.get(p.url) ?? 0;
    return {
      url: p.url,
      pageType: p.pageType,
      inboundTotal: total,
      inboundContextual: contextual,
      outboundTotal: outboundTotal.get(p.url) ?? 0,
      depth: depths.get(p.url) ?? null,
      isOrphan: p.url !== homepageUrl && total === 0,
      authorityScore: Math.round((contextual / maxContextual) * 100),
    };
  });

  // Suggestions: for under-linked important pages, propose the highest-
  // authority pages that don't already link to it.
  const byAuthority = [...stats].sort((a, b) => b.authorityScore - a.authorityScore);
  const suggestions: LinkSuggestion[] = [];
  for (const s of stats) {
    if (!IMPORTANT_PAGE_TYPES.has(s.pageType)) continue;
    if (s.inboundContextual >= MIN_CONTEXTUAL_LINKS_FOR_IMPORTANT_PAGES) continue;

    const alreadyLinking = linkedFrom.get(s.url) ?? new Set();
    const candidates = byAuthority
      .filter((c) => c.url !== s.url && !alreadyLinking.has(c.url))
      .slice(0, 3)
      .map((c) => c.url);

    if (candidates.length > 0) suggestions.push({ targetUrl: s.url, suggestedSources: candidates });
  }

  return { stats, suggestions };
}

export interface PageFinding {
  url: string;
  finding: RawFinding;
}

export function runInternalLinkFindings(stats: PageLinkStats[]): PageFinding[] {
  const findings: PageFinding[] = [];

  for (const s of stats) {
    if (s.isOrphan) {
      findings.push({
        url: s.url,
        finding: {
          category: "technical",
          checkStep: "Internal Link Graph",
          title: "Orphan page — zero inbound internal links",
          description: `No other crawled page links to ${s.url}. Search engines rely heavily on internal links to discover and understand page importance — an orphan page is effectively invisible internally.`,
          fixType: "Add at least one contextual internal link to this page from a relevant, already-linked page.",
          priority: IMPORTANT_PAGE_TYPES.has(s.pageType) ? "CRITICAL" : "HIGH",
          confidence: 100,
          fixLocation: "Content rewrite",
        },
      });
      continue; // orphan already covers the "too few links" case
    }

    if (IMPORTANT_PAGE_TYPES.has(s.pageType) && s.inboundContextual < MIN_CONTEXTUAL_LINKS_FOR_IMPORTANT_PAGES) {
      findings.push({
        url: s.url,
        finding: {
          category: "technical",
          checkStep: "Internal Link Graph",
          title: "Important page has too few contextual internal links",
          description: `${s.url} has only ${s.inboundContextual} contextual internal link(s) (nav/footer links don't count — they're on every page and don't differentiate importance). Money pages typically need more.`,
          fixType: "Add contextual links from related content and higher-authority pages.",
          priority: "MEDIUM",
          confidence: 80,
          fixLocation: "Content rewrite",
        },
      });
    }
  }

  return findings;
}
