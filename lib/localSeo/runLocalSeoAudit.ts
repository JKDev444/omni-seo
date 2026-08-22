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

  const findings = runNapConsistencyCheck(sources);
  await syncGbpCitationStatus(siteId, gbpProfile !== null, findings);
  return findings;
}

/**
 * Keeps the Dashboard's Citation Tracker "Google Business Profile" row
 * real instead of the fabricated placeholder it shipped with (found live
 * during an accuracy audit -- it showed a hardcoded "NAP inconsistent"
 * red dot with a note admitting "Sample data — not a live check", which
 * looks identical to a genuine finding). Derives napConsistent/indexed
 * from the NAP check that already runs every crawl, the same way the
 * Scorecard's real metrics replaced its own seeded placeholders.
 * No-op if the row was never seeded (nothing to update).
 */
async function syncGbpCitationStatus(siteId: string, hasGbpProfile: boolean, findings: RawFinding[]): Promise<void> {
  const citation = await prisma.citation.findFirst({ where: { siteId, directory: "Google Business Profile" } });
  if (!citation) return;

  const sourceUnavailable = findings.some((f) => f.title === "NAP source unavailable: GBP public listing");
  const mismatchFound = findings.some((f) => f.title.endsWith("vs. GBP public listing") && (f.title.startsWith("Phone mismatch") || f.title.startsWith("Address mismatch")));

  await prisma.citation.update({
    where: { id: citation.id },
    data: {
      napConsistent: sourceUnavailable ? null : !mismatchFound,
      indexed: hasGbpProfile ? true : null,
      lastCheckedAt: new Date(),
      notes: hasGbpProfile ? null : "No cached GBP profile yet — run the Places API pull (scripts/runGbpProfilePull.ts) to enable a real check.",
    },
  });
}
