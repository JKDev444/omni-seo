import { prisma } from "@/lib/db";
import { getActiveSite } from "@/lib/data/activeSite";
import { getContentStackCompleteness, type StackCompleteness } from "@/lib/data/contentStacks";

export interface ContentStacksPageData {
  site: { id: string } | null;
  stacks: StackCompleteness[];
  avgCompleteness: number | null;
}

export async function getContentStacksPageData(): Promise<ContentStacksPageData> {
  const site = await getActiveSite();
  if (!site) return { site: null, stacks: [], avgCompleteness: null };

  const stacks = await getContentStackCompleteness(site.id);
  const avgCompleteness =
    stacks.length > 0 ? Math.round(stacks.reduce((sum, s) => sum + s.completenessScore, 0) / stacks.length) : null;

  return { site: { id: site.id }, stacks, avgCompleteness };
}
