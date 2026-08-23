/**
 * Phase W: builds the real-data digest the chat assistant is grounded
 * in. Deliberately reuses the same data functions every other page
 * calls (getActionPlanData, getDashboardData) rather than querying
 * Prisma directly here -- a second, slightly-different source of truth
 * for "how many critical findings are there" is exactly how the
 * Scorecard/Citation Tracker fabrication bugs happened earlier in this
 * project. If the chat's numbers disagree with the Action Plan page,
 * that's a bug; sharing the data function is what prevents it.
 */
import { getActionPlanData } from "@/lib/data/actionPlan";
import { getDashboardData } from "@/lib/data/dashboard";

function pathFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname === "/" ? "/" : u.pathname;
  } catch {
    return url;
  }
}

function fmtDate(d: Date | null): string {
  if (!d) return "never";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d);
}

export async function buildChatContext(): Promise<string | null> {
  const [actionPlan, dashboard] = await Promise.all([getActionPlanData(), getDashboardData()]);

  if (!actionPlan.site || !dashboard.site) return null;

  const activeMaintenanceTasks = dashboard.maintenance.tasks.filter((t) => t.week === dashboard.maintenance.activeWeek && t.status !== "done");

  const digest = {
    site: dashboard.site.domain,
    lastCrawl: fmtDate(actionPlan.latestCrawlAt),
    openFindingCounts: actionPlan.counts,
    healthScores: dashboard.rings.map((r) => ({ area: r.label, score: r.score, openFindings: r.openCount })),
    scorecard: dashboard.scorecard
      .filter((s) => s.current !== null)
      .map((s) => ({ metric: s.metric, current: s.current, target: s.target, baseline: s.baseline })),
    roadmap: {
      next30Days: { count: actionPlan.roadmap.day30.count, quickWins: actionPlan.roadmap.day30.quickWinCount },
      next60Days: { count: actionPlan.roadmap.day60.count, quickWins: actionPlan.roadmap.day60.quickWinCount },
      next90Days: { count: actionPlan.roadmap.day90.count, quickWins: actionPlan.roadmap.day90.quickWinCount },
    },
    // "Do Now" is exactly what a "what should I work on today" question
    // should draw from -- it's already the app's own definition of
    // top-priority work, capped so the digest stays small.
    doNowItems: actionPlan.doNow.slice(0, 20).map((f) => ({
      priority: f.priority,
      title: f.title,
      page: f.page ? pathFromUrl(f.page.url) : null,
      fixType: f.fixType,
    })),
    doNowTotalCount: actionPlan.doNow.length,
    thisWeekMaintenanceTasks: activeMaintenanceTasks.map((t) => ({ area: t.area, task: t.task })),
    maintenanceMonth: dashboard.maintenance.month,
    maintenanceActiveWeek: dashboard.maintenance.activeWeek,
  };

  return JSON.stringify(digest, null, 2);
}
