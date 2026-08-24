"use server";

import { revalidatePath } from "next/cache";
import { triggerWorkflow, type GithubResult } from "@/lib/integrations/github";

export async function triggerWeeklySync(): Promise<GithubResult<null>> {
  const result = await triggerWorkflow("weekly-seo-sync.yml");
  revalidatePath("/automation");
  return result;
}

export async function triggerMonthlySync(): Promise<GithubResult<null>> {
  const result = await triggerWorkflow("monthly-seo-sync.yml");
  revalidatePath("/automation");
  return result;
}
