/**
 * Default citation directories — the exact starter list from the Citation
 * Tracker tab of SEO_Operating_Tracker.xlsx, not a general "best
 * directories" guess. "Industry-specific directory #1" is left as a
 * literal placeholder from the template (e.g. RealSelf or Healthgrades
 * would be reasonable for a med spa) rather than silently assumed —
 * confirm and rename it once decided.
 */
import { prisma } from "@/lib/db";

export const DEFAULT_CITATION_DIRECTORIES = [
  "Google Business Profile",
  "Bing Places",
  "Apple Business Connect",
  "Facebook Business Page",
  "Yelp",
  "Better Business Bureau",
  "Nextdoor",
  "Industry-specific directory #1",
  "Chamber of Commerce",
] as const;

/** Creates any missing default citation rows for a site. Idempotent. */
export async function seedDefaultCitations(siteId: string) {
  const site = await prisma.site.findUniqueOrThrow({ where: { id: siteId } });
  const existing = await prisma.citation.findMany({ where: { siteId }, select: { directory: true } });
  const existingNames = new Set(existing.map((c) => c.directory));

  const toCreate = DEFAULT_CITATION_DIRECTORIES.filter((d) => !existingNames.has(d));
  if (toCreate.length === 0) return { created: 0 };

  await prisma.citation.createMany({
    data: toCreate.map((directory) => ({
      siteId,
      directory,
      publicUrl: directory === "Google Business Profile" ? site.gbpUrl : null,
      notes:
        directory === "Industry-specific directory #1"
          ? "Placeholder from the tracker template — confirm the right directory for medical aesthetics (e.g. RealSelf, Healthgrades) and rename."
          : null,
    })),
  });

  return { created: toCreate.length };
}
