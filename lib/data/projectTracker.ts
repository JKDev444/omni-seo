import { prisma } from "@/lib/db";
import type { ProjectPhaseStatus, ProjectTaskStatus } from "@prisma/client";

export interface TrackerTask {
  id: string;
  title: string;
  status: ProjectTaskStatus;
  notes: string | null;
  completedAt: Date | null;
}

export interface TrackerPhase {
  id: string;
  key: string;
  name: string;
  summary: string | null;
  status: ProjectPhaseStatus;
  tasks: TrackerTask[];
  doneCount: number;
  totalCount: number;
}

export interface ProjectTrackerData {
  phases: TrackerPhase[];
  overall: { done: number; total: number; percent: number };
}

export async function getProjectTrackerData(): Promise<ProjectTrackerData> {
  const phases = await prisma.projectPhase.findMany({
    orderBy: { order: "asc" },
    include: { tasks: { orderBy: { order: "asc" } } },
  });

  const trackerPhases: TrackerPhase[] = phases.map((p) => {
    const relevant = p.tasks.filter((t) => t.status !== "SKIPPED");
    const doneCount = p.tasks.filter((t) => t.status === "DONE").length;
    return {
      id: p.id,
      key: p.key,
      name: p.name,
      summary: p.summary,
      status: p.status,
      tasks: p.tasks,
      doneCount,
      totalCount: relevant.length,
    };
  });

  const done = trackerPhases.reduce((sum, p) => sum + p.doneCount, 0);
  const total = trackerPhases.reduce((sum, p) => sum + p.totalCount, 0);

  return {
    phases: trackerPhases,
    overall: { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) },
  };
}
