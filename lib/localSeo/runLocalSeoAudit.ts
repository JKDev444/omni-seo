import { prisma } from "@/lib/db";
import type { RawFinding } from "@/lib/checks/onPageChecks";
import { extractFooterNap, extractLocalBusinessSchema, schemaAddressText, type NapSnapshot } from "@/lib/localSeo/extract";
import { runNapConsistencyCheck, type NapSource } from "@/lib/localSeo/napCheck";
import { fetchGbpPublicData, type GbpPullResult } from "@/lib/integrations/places";

/** Pulls public GBP data via Places API and caches it in GbpProfile. */
export async function pullGbpProfile(siteId: string): Promise<GbpPullResult> {
  const site = await prisma.site.findUniqueOrThrow({ where: { id: siteId } });
  const result = await fetchGbpPublicData(site.gbpPlaceId);

  if (result.ok) {
    const { data } = result;
    await prisma.gbpProfile.upsert({
      where: { siteId },
      update: {
        placeId: data.placeId,
        name: data.name,
        primaryCategory: data.primaryCategory,
        categories: data.categories,
        address: data.address,
        phone: data.phone,
        hours: data.hours ?? undefined,
        rating: data.rating,
        reviewCount: data.reviewCount,
        photoCount: data.photoCount,
        raw: data.raw as object,
        source: "places_api",
        fetchedAt: new Date(),
      },
      create: {
        siteId,
        placeId: data.placeId,
        name: data.name,
        primaryCategory: data.primaryCategory,
        categories: data.categories,
        address: data.address,
        phone: data.phone,
        hours: data.hours ?? undefined,
        rating: data.rating,
        reviewCount: data.reviewCount,
        photoCount: data.photoCount,
        raw: data.raw as object,
        source: "places_api",
      },
    });
  }

  return result;
}

/**
 * Cross-checks NAP across the homepage footer, the homepage's LocalBusiness
 * schema, and the cached GBP public listing (if any). Sitewide, so it's run
 * once per crawl against the homepage, not per page.
 */
export async function runLocalSeoChecks(siteId: string, homepageHtml: string): Promise<RawFinding[]> {
  const footer = extractFooterNap(homepageHtml);
  const schema = extractLocalBusinessSchema(homepageHtml);
  const schemaNap: NapSnapshot = { phone: schema?.telephone ?? null, addressText: schemaAddressText(schema) };

  const gbpProfile = await prisma.gbpProfile.findUnique({ where: { siteId } });
  const gbpNap: NapSnapshot | null = gbpProfile
    ? { phone: gbpProfile.phone, addressText: gbpProfile.address }
    : null;

  const sources: NapSource[] = [
    { label: "footer", nap: footer },
    { label: "schema", nap: schemaNap },
    { label: "GBP public listing", nap: gbpNap },
  ];

  return runNapConsistencyCheck(sources);
}
