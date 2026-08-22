"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { ACTIVE_SITE_COOKIE, ACTIVE_SITE_COOKIE_MAX_AGE } from "@/lib/data/activeSite";

export async function setActiveSite(siteId: string): Promise<void> {
  const site = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true } });
  if (!site) throw new Error(`No site with id "${siteId}".`);

  const store = await cookies();
  store.set(ACTIVE_SITE_COOKIE, siteId, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: ACTIVE_SITE_COOKIE_MAX_AGE,
    path: "/",
  });

  // Every page reads the active site fresh on each request -- revalidating
  // the whole layout is the simplest way to make every page (not just the
  // one the switcher happens to be on) reflect the new selection immediately.
  revalidatePath("/", "layout");
}
