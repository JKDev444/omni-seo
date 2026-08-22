/**
 * The unified "what do I actually need to do" view — Phase P (Guided
 * Roadmap). Every other page in this app shows real findings for one
 * specific check; this page is the one place that pulls all of them
 * together into a prioritized, actionable plan, the way a tool like
 * SearchAtlas puts a task list front and center instead of leaving the
 * user to piece one together from a dozen separate reports.
 */
import { prisma } from "@/lib/db";
import type { Priority } from "@prisma/client";
import { getActiveSite } from "@/lib/data/activeSite";
import { getActiveMaintenanceWeek } from "@/lib/maintenance/seedMonth";
import { getContentStackCompleteness } from "@/lib/data/contentStacks";
import { getOpenFindingsForSite, type FindingWithPage } from "@/lib/findings/getOpenFindings";
import { computeRoadmapPlan, type RoadmapPlan } from "@/lib/data/roadmapPlan";

export type { FindingWithPage };

export interface CtrRewriteAction {
  url: string;
  suggestedTitle: string;
  suggestedMetaDesc: string;
  impressions: number;
}

export interface ContentStackAction {
  topic: string;
  completenessScore: number;
  pillarUrl: string | null;
  supportingArticleCount: number;
}

export interface BacklinkOutreachAction {
  referringDomain: string;
  referringDomainRank: number | null;
  competitorDomain: string;
}

export interface ActionPlanData {
  site: { id: string } | null;
  latestCrawlAt: Date | null;
  doNow: FindingWithPage[]; // CRITICAL + HIGH open findings
  thisMonth: {
    findings: FindingWithPage[]; // MEDIUM open findings, capped for display
    findingsTotal: number; // real count, before capping
    ctrRewrites: CtrRewriteAction[];
    contentStackGaps: ContentStackAction[];
    backlinkOutreach: BacklinkOutreachAction[];
  };
  ongoing: {
    findings: FindingWithPage[]; // LOW open findings
    maintenanceTasks: { id: string; week: number; area: string; task: string; status: string }[];
    maintenanceMonth: string;
  };
  counts: { critical: number; high: number; medium: number; low: number };
  roadmap: RoadmapPlan;
}

export async function getActionPlanData(): Promise<ActionPlanData> {
  const site = await getActiveSite();
  if (!site) {
    return {
      site: null,
      latestCrawlAt: null,
      doNow: [],
      thisMonth: { findings: [], findingsTotal: 0, ctrRewrites: [], contentStackGaps: [], backlinkOutreach: [] },
      ongoing: { findings: [], maintenanceTasks: [], maintenanceMonth: "" },
      counts: { critical: 0, high: 0, medium: 0, low: 0 },
      roadmap: computeRoadmapPlan([]),
    };
  }

  const latestCrawl = await prisma.crawl.findFirst({ where: { siteId: site.id, status: "completed" }, orderBy: { startedAt: "desc" } });

  const openFindings = await getOpenFindingsForSite(site.id);

  const byPriority: Record<Priority, FindingWithPage[]> = { CRITICAL: [], HIGH: [], MEDIUM: [], LOW: [] };
  for (const f of openFindings) byPriority[f.priority].push(f);

  const [ctrRewrites, stackCompleteness, backlinkGap, maintenance] = await Promise.all([
    prisma.ctrRewriteSuggestion.findMany({ where: { siteId: site.id }, orderBy: { impressions: "desc" }, take: 10 }),
    getContentStackCompleteness(site.id),
    prisma.backlinkGapDomain.findMany({ where: { siteId: site.id }, orderBy: { referringDomainRank: "desc" }, take: 10 }),
    getActiveMaintenanceWeek(site.id),
  ]);

  const maintenanceTasks = await prisma.maintenanceTask.findMany({
    where: { siteId: site.id, month: maintenance.month, status: { not: "done" } },
    orderBy: [{ week: "asc" }, { id: "asc" }],
  });

  // Reuses the exact same scoring as /content-stacks (pillar presence,
  // supporting content, two-way internal linking, orphans) so the two
  // pages never disagree on the same topic's completeness.
  const stackGaps: ContentStackAction[] = stackCompleteness
    .filter((s) => s.completenessScore < 70)
    .map((s) => ({
      topic: s.topic,
      completenessScore: s.completenessScore,
      pillarUrl: s.pillarUrl,
      supportingArticleCount: s.supportingArticleCount,
    }));

  return {
    site: { id: site.id },
    latestCrawlAt: latestCrawl?.startedAt ?? null,
    doNow: [...byPriority.CRITICAL, ...byPriority.HIGH],
    thisMonth: {
      findings: byPriority.MEDIUM.slice(0, 20),
      findingsTotal: byPriority.MEDIUM.length,
      ctrRewrites: ctrRewrites.map((r) => ({
        url: r.url,
        suggestedTitle: r.suggestedTitle,
        suggestedMetaDesc: r.suggestedMetaDesc,
        impressions: r.impressions,
      })),
      contentStackGaps: stackGaps,
      backlinkOutreach: backlinkGap.map((g) => ({
        referringDomain: g.referringDomain,
        referringDomainRank: g.referringDomainRank,
        competitorDomain: g.competitorDomain,
      })),
    },
    ongoing: {
      findings: byPriority.LOW,
      maintenanceTasks: maintenanceTasks.map((t) => ({ id: t.id, week: t.week, area: t.area, task: t.task, status: t.status })),
      maintenanceMonth: maintenance.month,
    },
    counts: {
      critical: byPriority.CRITICAL.length,
      high: byPriority.HIGH.length,
      medium: byPriority.MEDIUM.length,
      low: byPriority.LOW.length,
    },
    roadmap: computeRoadmapPlan(openFindings),
  };
}
