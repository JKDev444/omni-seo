import { prisma } from "@/lib/db";
import { MONTHLY_MAINTENANCE_TEMPLATE } from "@/lib/maintenance/tasks";

/** "2026-08" for the given date, in UTC. */
export function monthKey(date: Date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Creates the fixed 19-task Week 1-4 set for a given month if it doesn't
 * already exist for this site. Mirrors "duplicate this tab each month" —
 * every month starts as a fresh, all-"not_started" set. Idempotent: safe
 * to call repeatedly for the same site/month.
 */
export async function seedMaintenanceMonth(siteId: string, month: string) {
  const existing = await prisma.maintenanceTask.count({ where: { siteId, month } });
  if (existing > 0) return { created: 0, alreadySeeded: true };

  await prisma.maintenanceTask.createMany({
    data: MONTHLY_MAINTENANCE_TEMPLATE.map((t) => ({
      siteId,
      month,
      week: t.week,
      area: t.area,
      task: t.task,
    })),
  });

  return { created: MONTHLY_MAINTENANCE_TEMPLATE.length, alreadySeeded: false };
}

/**
 * Per the SOP's MAINTENANCE workflow: "find the earliest week-block (1-4)
 * that isn't fully Done, and execute that week's tasks. If Week 4 was just
 * completed, duplicate the tab for the next month and reset statuses to
 * Not Started." Auto-seeds the current month if nothing exists yet, and
 * rolls into next month once the latest month's Week 4 is fully done.
 */
export async function getActiveMaintenanceWeek(siteId: string): Promise<{ month: string; week: number }> {
  const latest = await prisma.maintenanceTask.findFirst({
    where: { siteId },
    orderBy: { month: "desc" },
    select: { month: true },
  });

  let month = latest?.month ?? monthKey();
  if (!latest) {
    await seedMaintenanceMonth(siteId, month);
  }

  const tasks = await prisma.maintenanceTask.findMany({ where: { siteId, month } });
  for (const week of [1, 2, 3, 4]) {
    const weekTasks = tasks.filter((t) => t.week === week);
    if (weekTasks.some((t) => t.status !== "done")) {
      return { month, week };
    }
  }

  // Every week of the latest month is done — roll into next month.
  const [y, m] = month.split("-").map(Number);
  const nextMonthDate = new Date(Date.UTC(y, m, 1)); // m is 1-indexed current month -> next month index
  month = monthKey(nextMonthDate);
  await seedMaintenanceMonth(siteId, month);
  return { month, week: 1 };
}
