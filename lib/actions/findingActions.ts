"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { FindingStatus } from "@prisma/client";

// The realistic subset of FindingStatus a person actually clicks from the
// UI — the rest (VERIFIED, THIRD_PARTY, PLATFORM_CONTROLLED,
// REQUIRES_ADMIN, ACCEPTED, NOT_CHANGED) are either set by automated
// re-crawl logic or too situational for a generic button; use the
// database directly (Prisma Studio) for those if ever needed.
const USER_SETTABLE_STATUSES: FindingStatus[] = ["COMPLETED", "IGNORED", "FALSE_POSITIVE", "IN_PROGRESS", "PENDING"];

export async function updateFindingStatus(findingId: string, status: FindingStatus): Promise<void> {
  if (!USER_SETTABLE_STATUSES.includes(status)) {
    throw new Error(`${status} is not settable from the UI.`);
  }
  await prisma.finding.update({ where: { id: findingId }, data: { status } });
  revalidatePath("/action-plan");
  revalidatePath("/dashboard");
}
