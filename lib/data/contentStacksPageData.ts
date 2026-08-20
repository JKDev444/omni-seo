import { prisma } from "@/lib/db";
import { V1_DOMAIN } from "@/lib/data/dashboard";
import { getContentStackCompleteness, type StackCompleteness } from "@/lib/data/contentStacks";

export interface ContentStacksPageData {
  site: { id: string } | null;
  stacks: StackCompleteness[];
  avgCompleteness: number | null;
}

export async function getContentStacksPageData(): Promise<ContentStacksPageData> {
  const site = await prisma.site.findUnique({ where: { domain: V1_DOMAIN } });
  if (!site) return { site: null, stacks: [], avgCompleteness: null };

  const stacks = await getContentStackCompleteness(site.id);
  const avgCompleteness =
    stacks.length > 0 ? Math.round(stacks.reduce((sum, s) => sum + s.completenessScore, 0) / stacks.length) : null;

  return { site: { id: site.id }, stacks, avgCompleteness };
}
