import { prisma } from "@/lib/db";
import { getActiveSite } from "@/lib/data/activeSite";

export interface BacklinkProfileRow {
  domain: string;
  isOwnDomain: boolean;
  rank: number | null;
  backlinks: number | null;
  referringDomains: number | null;
  referringDomainsNofollow: number | null;
  brokenBacklinks: number | null;
  spamScore: number | null;
  fetchedAt: Date;
}

export interface BacklinkGapRow {
  competitorDomain: string;
  referringDomain: string;
  referringDomainRank: number | null;
  backlinksToCompetitor: number | null;
}

export interface BacklinksPageData {
  site: { id: string } | null;
  profiles: BacklinkProfileRow[];
  gap: BacklinkGapRow[];
}

export async function getBacklinksPageData(): Promise<BacklinksPageData> {
  const site = await getActiveSite();
  if (!site) return { site: null, profiles: [], gap: [] };

  // Latest profile per domain — profiles are kept historically, so take
  // the most recent fetchedAt for each distinct domain.
  const allProfiles = await prisma.backlinkProfile.findMany({ where: { siteId: site.id }, orderBy: { fetchedAt: "desc" } });
  const latestByDomain = new Map<string, (typeof allProfiles)[number]>();
  for (const p of allProfiles) {
    if (!latestByDomain.has(p.domain)) latestByDomain.set(p.domain, p);
  }

  const gap = await prisma.backlinkGapDomain.findMany({
    where: { siteId: site.id },
    orderBy: { referringDomainRank: "desc" },
  });

  return {
    site: { id: site.id },
    profiles: [...latestByDomain.values()]
      .sort((a, b) => (a.isOwnDomain === b.isOwnDomain ? (b.referringDomains ?? 0) - (a.referringDomains ?? 0) : a.isOwnDomain ? -1 : 1))
      .map((p) => ({
        domain: p.domain,
        isOwnDomain: p.isOwnDomain,
        rank: p.rank,
        backlinks: p.backlinks,
        referringDomains: p.referringDomains,
        referringDomainsNofollow: p.referringDomainsNofollow,
        brokenBacklinks: p.brokenBacklinks,
        spamScore: p.spamScore,
        fetchedAt: p.fetchedAt,
      })),
    gap: gap.map((g) => ({
      competitorDomain: g.competitorDomain,
      referringDomain: g.referringDomain,
      referringDomainRank: g.referringDomainRank,
      backlinksToCompetitor: g.backlinksToCompetitor,
    })),
  };
}
