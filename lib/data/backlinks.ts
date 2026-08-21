/**
 * Phase L: pulls backlink summaries for our domain plus tracked
 * competitors, and computes a real backlink gap (referring domains that
 * link to a competitor but not to us) as a client-side set difference —
 * see dataforseoBacklinks.ts for why this isn't done via DataForSEO's
 * domain_intersection endpoint.
 */
import { prisma } from "@/lib/db";
import { fetchBacklinkSummary, fetchReferringDomains } from "@/lib/integrations/dataforseoBacklinks";

export interface BacklinkRunResult {
  ok: boolean;
  profilesFetched: number;
  gapDomainsFound: number;
  errors: number;
  errorDetails: { domain: string; message: string }[];
  message?: string;
}

export async function pullBacklinkProfiles(siteId: string, ourDomain: string, competitorDomains: string[]): Promise<BacklinkRunResult> {
  let profilesFetched = 0;
  let errors = 0;
  const errorDetails: { domain: string; message: string }[] = [];

  const allDomains = [{ domain: ourDomain, isOwnDomain: true }, ...competitorDomains.map((d) => ({ domain: d, isOwnDomain: false }))];
  const referringSets = new Map<string, Map<string, { rank: number | null; backlinks: number | null }>>();

  for (const { domain, isOwnDomain } of allDomains) {
    const summary = await fetchBacklinkSummary(domain);
    if (!summary.ok) {
      if (summary.reason === "missing_credentials") {
        return { ok: false, profilesFetched, gapDomainsFound: 0, errors, errorDetails, message: summary.message };
      }
      errors++;
      errorDetails.push({ domain, message: summary.message });
      continue;
    }

    await prisma.backlinkProfile.create({
      data: {
        siteId,
        domain,
        isOwnDomain,
        rank: summary.data.rank,
        backlinks: summary.data.backlinks,
        referringDomains: summary.data.referringDomains,
        referringDomainsNofollow: summary.data.referringDomainsNofollow,
        brokenBacklinks: summary.data.brokenBacklinks,
        spamScore: summary.data.spamScore,
        firstSeen: summary.data.firstSeen ? new Date(summary.data.firstSeen) : null,
      },
    });
    profilesFetched++;

    const referring = await fetchReferringDomains(domain);
    if (referring.ok) {
      referringSets.set(domain, new Map(referring.data.map((r) => [r.domain, { rank: r.rank, backlinks: r.backlinks }])));
    } else {
      referringSets.set(domain, new Map());
    }
  }

  // Gap: domains that link to a competitor but not to us.
  const ourReferring = referringSets.get(ourDomain) ?? new Map<string, { rank: number | null; backlinks: number | null }>();
  const existingGap = await prisma.backlinkGapDomain.findMany({ where: { siteId } });
  if (existingGap.length > 0) {
    await prisma.backlinkGapDomain.deleteMany({ where: { siteId } });
  }

  let gapDomainsFound = 0;
  for (const competitor of competitorDomains) {
    const competitorReferring = referringSets.get(competitor);
    if (!competitorReferring) continue;

    for (const [refDomain, info] of competitorReferring) {
      if (ourReferring.has(refDomain)) continue; // not a gap — they link to us too
      await prisma.backlinkGapDomain.create({
        data: {
          siteId,
          competitorDomain: competitor,
          referringDomain: refDomain,
          referringDomainRank: info.rank,
          backlinksToCompetitor: info.backlinks,
        },
      });
      gapDomainsFound++;
    }
  }

  return { ok: true, profilesFetched, gapDomainsFound, errors, errorDetails };
}
