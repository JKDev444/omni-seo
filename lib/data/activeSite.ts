/**
 * Phase T: the single "which site am I looking at" resolution point,
 * replacing the old hardcoded `V1_DOMAIN = "omnicenters.com"` that every
 * page's data function used to import. Deliberately a cookie-based
 * active-site selection, not per-site URLs (`/sites/[siteId]/...`) --
 * this app is used internally by one operator switching between a
 * handful of businesses, not a customer-facing multi-tenant product, so
 * shareable per-site URLs aren't worth the much larger restructuring
 * (every page route, every internal link) that would require. If this
 * ever becomes customer-facing, that's the point to revisit.
 */
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import type { Site } from "@prisma/client";

const ACTIVE_SITE_COOKIE = "activeSiteId";
export const ACTIVE_SITE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/**
 * Resolves to the cookie's site if it still exists, otherwise the
 * earliest-created site (stable default so it doesn't jump around), or
 * null if no sites exist yet at all.
 */
export async function getActiveSite(): Promise<Site | null> {
  const store = await cookies();
  const cookieSiteId = store.get(ACTIVE_SITE_COOKIE)?.value;

  if (cookieSiteId) {
    const site = await prisma.site.findUnique({ where: { id: cookieSiteId } });
    if (site) return site;
  }

  return prisma.site.findFirst({ orderBy: { createdAt: "asc" } });
}

export async function getAllSites(): Promise<Site[]> {
  return prisma.site.findMany({ orderBy: { createdAt: "asc" } });
}

export { ACTIVE_SITE_COOKIE };
