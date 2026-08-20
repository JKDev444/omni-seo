/**
 * Phase J: Topical Authority / Content Stacks. Clusters crawled pages into
 * per-service content stacks (LLM-assisted, see contentStackClustering.ts)
 * and scores each stack's completeness: pillar present, supporting article
 * coverage, two-way internal linking between stack members, and orphans
 * within the stack — mirrors the content-stack framework already used for
 * this site's real content planning.
 */
import { prisma } from "@/lib/db";
import { PageType } from "@prisma/client";
import { clusterPagesIntoStacks, type PageForClustering } from "@/lib/integrations/contentStackClustering";

const CLUSTERABLE_TYPES: PageType[] = [PageType.SERVICE_PAGE, PageType.BLOG_ARTICLE];

export interface ClusterRunResult {
  ok: boolean;
  stacksCreated: number;
  pagesAssigned: number;
  message?: string;
}

/** Re-runs LLM clustering and replaces all existing stacks for this site. Real per-run API cost — a single batch call, not per-page. */
export async function pullContentStackClustering(siteId: string): Promise<ClusterRunResult> {
  const pages = await prisma.page.findMany({
    where: { siteId, pageType: { in: CLUSTERABLE_TYPES }, lastCrawledAt: { not: null } },
    select: { id: true, url: true, title: true, h1: true, pageType: true },
  });

  if (pages.length === 0) {
    return { ok: true, stacksCreated: 0, pagesAssigned: 0, message: "No crawled service pages or blog articles to cluster yet." };
  }

  const input: PageForClustering[] = pages.map((p) => ({ url: p.url, title: p.title, h1: p.h1, pageType: p.pageType }));
  const result = await clusterPagesIntoStacks(input);

  if (!result.ok) {
    return { ok: false, stacksCreated: 0, pagesAssigned: 0, message: result.message };
  }

  const urlToPageId = new Map(pages.map((p) => [p.url, p.id]));

  // Replace prior clustering entirely — topical grouping can shift as
  // content changes, and stale stacks would silently keep scoring pages
  // that no longer belong together.
  const existingStacks = await prisma.contentStack.findMany({ where: { siteId }, select: { id: true } });
  if (existingStacks.length > 0) {
    await prisma.contentStackMember.deleteMany({ where: { contentStackId: { in: existingStacks.map((s) => s.id) } } });
    await prisma.contentStack.deleteMany({ where: { siteId } });
  }

  let stacksCreated = 0;
  let pagesAssigned = 0;

  for (const stack of result.stacks) {
    const validMembers = stack.members.filter((m) => urlToPageId.has(m.url));
    if (validMembers.length === 0) continue;

    const created = await prisma.contentStack.create({ data: { siteId, topic: stack.topic } });
    stacksCreated++;

    for (const m of validMembers) {
      await prisma.contentStackMember.create({
        data: {
          contentStackId: created.id,
          pageId: urlToPageId.get(m.url)!,
          url: m.url,
          role: m.role.toUpperCase() as "PILLAR" | "SERVICE_PAGE" | "SUPPORTING_ARTICLE",
        },
      });
      pagesAssigned++;
    }
  }

  return { ok: true, stacksCreated, pagesAssigned };
}

export interface StackCompleteness {
  topic: string;
  pillarUrl: string | null;
  servicePageCount: number;
  supportingArticleCount: number;
  memberCount: number;
  linkedMemberCount: number; // members with at least one internal link to/from another stack member
  orphanCount: number; // members with zero internal links to/from any other stack member
  completenessScore: number;
  members: { url: string; role: string; hasInboundFromStack: boolean; hasOutboundToStack: boolean }[];
}

export async function getContentStackCompleteness(siteId: string): Promise<StackCompleteness[]> {
  const stacks = await prisma.contentStack.findMany({
    where: { siteId },
    include: { members: true },
    orderBy: { topic: "asc" },
  });

  if (stacks.length === 0) return [];

  const latestCrawl = await prisma.crawl.findFirst({ where: { siteId, status: "completed" }, orderBy: { startedAt: "desc" } });
  const links = latestCrawl
    ? await prisma.internalLink.findMany({ where: { crawlId: latestCrawl.id }, select: { sourceUrl: true, targetUrl: true } })
    : [];

  const outboundFrom = new Map<string, Set<string>>();
  for (const l of links) {
    const set = outboundFrom.get(l.sourceUrl) ?? new Set<string>();
    set.add(l.targetUrl);
    outboundFrom.set(l.sourceUrl, set);
  }

  return stacks.map((stack) => {
    const memberUrls = new Set(stack.members.map((m) => m.url));
    const pillar = stack.members.find((m) => m.role === "PILLAR");
    const servicePageCount = stack.members.filter((m) => m.role === "SERVICE_PAGE").length;
    const supportingArticleCount = stack.members.filter((m) => m.role === "SUPPORTING_ARTICLE").length;

    const memberDetails = stack.members.map((m) => {
      const outbound = outboundFrom.get(m.url) ?? new Set<string>();
      const hasOutboundToStack = [...outbound].some((target) => memberUrls.has(target) && target !== m.url);
      const hasInboundFromStack = [...memberUrls].some(
        (other) => other !== m.url && (outboundFrom.get(other) ?? new Set()).has(m.url)
      );
      return { url: m.url, role: m.role, hasInboundFromStack, hasOutboundToStack };
    });

    const linkedMemberCount = memberDetails.filter((m) => m.hasInboundFromStack || m.hasOutboundToStack).length;
    const orphanCount = memberDetails.filter((m) => !m.hasInboundFromStack && !m.hasOutboundToStack).length;

    const pillarPresent = !!pillar;
    const hasSupportingContent = supportingArticleCount > 0;
    const linkCoverageRatio = memberDetails.length > 0 ? linkedMemberCount / memberDetails.length : 0;
    const orphanRatio = memberDetails.length > 0 ? orphanCount / memberDetails.length : 0;

    const completenessScore = Math.round(
      (pillarPresent ? 30 : 0) + (hasSupportingContent ? 20 : 0) + linkCoverageRatio * 30 + (1 - orphanRatio) * 20
    );

    return {
      topic: stack.topic,
      pillarUrl: pillar?.url ?? null,
      servicePageCount,
      supportingArticleCount,
      memberCount: stack.members.length,
      linkedMemberCount,
      orphanCount,
      completenessScore,
      members: memberDetails,
    };
  }).sort((a, b) => a.completenessScore - b.completenessScore);
}
