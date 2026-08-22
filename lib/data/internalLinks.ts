import { prisma } from "@/lib/db";
import { getActiveSite } from "@/lib/data/activeSite";
import { analyzeLinkGraph, type PageLinkStats, type LinkSuggestion } from "@/lib/checks/internalLinkGraph";

export interface InternalLinksData {
  site: { id: string } | null;
  hasData: boolean;
  stats: PageLinkStats[];
  suggestions: LinkSuggestion[];
  orphanCount: number;
  maxDepth: number | null;
}

export async function getInternalLinksData(): Promise<InternalLinksData> {
  const site = await getActiveSite();
  if (!site) return { site: null, hasData: false, stats: [], suggestions: [], orphanCount: 0, maxDepth: null };

  const latestCrawl = await prisma.crawl.findFirst({ where: { siteId: site.id, status: "completed" }, orderBy: { startedAt: "desc" } });
  if (!latestCrawl) return { site: { id: site.id }, hasData: false, stats: [], suggestions: [], orphanCount: 0, maxDepth: null };

  const [allPages, links] = await Promise.all([
    prisma.page.findMany({ where: { siteId: site.id }, select: { url: true, pageType: true, lastCrawledAt: true } }),
    prisma.internalLink.findMany({ where: { crawlId: latestCrawl.id }, select: { sourceUrl: true, targetUrl: true, isContextual: true } }),
  ]);

  // The Page table can accumulate stale rows across a project's life
  // (old seed data, renamed URLs, etc.) that were never part of this
  // crawl. Including them would corrupt the graph — e.g. a stale
  // homepage-type row with zero real links would get picked as the BFS
  // root, making every genuinely-linked page look "unreachable." Scope
  // to pages this specific crawl actually touched.
  const pages = allPages.filter((p) => p.lastCrawledAt && p.lastCrawledAt >= latestCrawl.startedAt);

  const homepage = pages.find((p) => p.pageType === "HOMEPAGE");
  if (!homepage || links.length === 0) {
    return { site: { id: site.id }, hasData: false, stats: [], suggestions: [], orphanCount: 0, maxDepth: null };
  }

  const { stats, suggestions } = analyzeLinkGraph({
    homepageUrl: homepage.url,
    pages: pages.map((p) => ({ url: p.url, pageType: p.pageType.toLowerCase() })),
    links,
  });

  const depths = stats.map((s) => s.depth).filter((d): d is number => d !== null);

  return {
    site: { id: site.id },
    hasData: true,
    stats: stats.sort((a, b) => a.authorityScore - b.authorityScore),
    suggestions,
    orphanCount: stats.filter((s) => s.isOrphan).length,
    maxDepth: depths.length > 0 ? Math.max(...depths) : null,
  };
}
