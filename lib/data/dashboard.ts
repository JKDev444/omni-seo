import { prisma } from "@/lib/db";
import type { Finding, Page, Priority } from "@prisma/client";
import { getActiveMaintenanceWeek } from "@/lib/maintenance/seedMonth";

export const V1_DOMAIN = "omnicenters.com";

export type FindingWithPage = Finding & { page: Page | null };

export interface HealthRing {
  label: string;
  score: number; // 0-100
  openCount: number;
}

export interface DashboardData {
  site: { id: string; domain: string; platform: string } | null;
  latestCrawl: { id: string; startedAt: Date; finishedAt: Date | null; pagesFound: number } | null;
  rings: HealthRing[];
  findingsByPriority: Record<Priority, FindingWithPage[]>;
  totalOpenFindings: number;
  scorecard: { metric: string; baseline: number | null; current: number | null; target: number | null; source: string | null }[];
  citations: { id: string; directory: string; publicUrl: string | null; napConsistent: boolean | null; indexed: boolean | null; lastCheckedAt: Date | null }[];
  maintenance: {
    month: string;
    activeWeek: number;
    tasks: { id: string; week: number; area: string; task: string; status: string; owner: string | null }[];
  };
}

const PRIORITY_WEIGHT: Record<Priority, number> = {
  CRITICAL: 20,
  HIGH: 10,
  MEDIUM: 5,
  LOW: 2,
};

// Categories in the schema (technical | local | content | schema | image | redirect)
// roll up into the three rings the dashboard shows.
const RING_CATEGORY_MAP: Record<string, "Technical" | "Local" | "Content"> = {
  technical: "Technical",
  schema: "Technical",
  redirect: "Technical",
  image: "Technical",
  local: "Local",
  content: "Content",
};

// Statuses that mean the finding is resolved, dismissed, or confirmed not
// real — everything else (including "blocked on X" statuses) is still an
// open problem and should keep counting against the score.
const CLOSED_STATUSES = new Set([
  "COMPLETED",
  "ALREADY_COMPLETED",
  "VERIFIED",
  "IGNORED",
  "FALSE_POSITIVE",
  "ACCEPTED",
]);

function isOpen(f: Finding): boolean {
  return !f.isFalsePositive && !CLOSED_STATUSES.has(f.status);
}

function scoreForFindings(findings: Finding[]): number {
  // Weight by confidence too — a heuristic finding self-reporting 60%
  // confidence shouldn't tank the score as hard as a deterministic one
  // reporting 100%.
  const penalty = findings.reduce((sum, f) => sum + PRIORITY_WEIGHT[f.priority] * (f.confidence / 100), 0);
  return Math.max(0, Math.round(100 - penalty));
}

export async function getDashboardData(): Promise<DashboardData> {
  const site = await prisma.site.findUnique({ where: { domain: V1_DOMAIN } });

  const empty: DashboardData = {
    site: null,
    latestCrawl: null,
    rings: [
      { label: "Technical", score: 0, openCount: 0 },
      { label: "Local", score: 0, openCount: 0 },
      { label: "Content", score: 0, openCount: 0 },
    ],
    findingsByPriority: { CRITICAL: [], HIGH: [], MEDIUM: [], LOW: [] },
    totalOpenFindings: 0,
    scorecard: [],
    citations: [],
    maintenance: { month: "", activeWeek: 1, tasks: [] },
  };

  if (!site) return empty;

  const latestCrawl = await prisma.crawl.findFirst({
    where: { siteId: site.id, status: "completed" },
    orderBy: { startedAt: "desc" },
  });

  const [allFindings, scorecard, citations] = await Promise.all([
    latestCrawl
      ? prisma.finding.findMany({
          where: { crawlId: latestCrawl.id },
          include: { page: true },
          orderBy: [{ priority: "asc" }, { detectedAt: "desc" }],
        })
      : Promise.resolve([] as FindingWithPage[]),
    prisma.scorecardMetric.findMany({ where: { siteId: site.id }, orderBy: { metric: "asc" } }),
    prisma.citation.findMany({ where: { siteId: site.id }, orderBy: { directory: "asc" } }),
  ]);

  const { month, week: activeWeek } = await getActiveMaintenanceWeek(site.id);
  const maintenanceTasks = await prisma.maintenanceTask.findMany({
    where: { siteId: site.id, month },
    orderBy: [{ week: "asc" }, { id: "asc" }],
  });

  const openFindings = allFindings.filter(isOpen);

  const ringBuckets: Record<"Technical" | "Local" | "Content", Finding[]> = {
    Technical: [],
    Local: [],
    Content: [],
  };
  for (const f of openFindings) {
    const ring = RING_CATEGORY_MAP[f.category] ?? "Technical";
    ringBuckets[ring].push(f);
  }

  const rings: HealthRing[] = (["Technical", "Local", "Content"] as const).map((label) => ({
    label,
    score: scoreForFindings(ringBuckets[label]),
    openCount: ringBuckets[label].length,
  }));

  const findingsByPriority: Record<Priority, FindingWithPage[]> = {
    CRITICAL: [],
    HIGH: [],
    MEDIUM: [],
    LOW: [],
  };
  for (const f of openFindings) {
    findingsByPriority[f.priority].push(f);
  }

  return {
    site: { id: site.id, domain: site.domain, platform: site.platform },
    latestCrawl: latestCrawl
      ? {
          id: latestCrawl.id,
          startedAt: latestCrawl.startedAt,
          finishedAt: latestCrawl.finishedAt,
          pagesFound: latestCrawl.pagesFound,
        }
      : null,
    rings,
    findingsByPriority,
    totalOpenFindings: openFindings.length,
    scorecard: scorecard.map((s) => ({
      metric: s.metric,
      baseline: s.baseline,
      current: s.current,
      target: s.target,
      source: s.source,
    })),
    citations: citations.map((c) => ({
      id: c.id,
      directory: c.directory,
      publicUrl: c.publicUrl,
      napConsistent: c.napConsistent,
      indexed: c.indexed,
      lastCheckedAt: c.lastCheckedAt,
    })),
    maintenance: {
      month,
      activeWeek,
      tasks: maintenanceTasks.map((t) => ({
        id: t.id,
        week: t.week,
        area: t.area,
        task: t.task,
        status: t.status,
        owner: t.owner,
      })),
    },
  };
}
