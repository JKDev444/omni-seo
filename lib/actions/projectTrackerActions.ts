"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { ProjectTaskStatus } from "@prisma/client";

export async function setTaskStatus(taskId: string, status: ProjectTaskStatus): Promise<void> {
  await prisma.projectTask.update({
    where: { id: taskId },
    data: { status, completedAt: status === "DONE" ? new Date() : null },
  });
  revalidatePath("/project-tracker");
}
