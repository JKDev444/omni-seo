/**
 * Google Search Console — Search Analytics query endpoint. This is the
 * only performance data the GSC API actually exposes (confirmed: no
 * Core Web Vitals endpoint — that's CrUX/PSI, a separate phase). Pulls
 * clicks/impressions/CTR/position by date, page, query, device, country.
 */
import { google } from "googleapis";
import { getGoogleServiceAccountAuth } from "./googleServiceAccount";
import { prisma } from "@/lib/db";

export type GscPullResult =
  | { ok: true; rowCount: number }
  | { ok: false; reason: "missing_credentials" | "invalid_credentials" | "missing_site_url" | "api_error"; message: string };

interface GscRow {
  keys: string[]; // [date, page, query, device, country] in the order requested
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/** Pulls the last `days` days of Search Analytics data and replaces the cached window for this site. */
export async function pullGscMetrics(siteId: string, days = 90): Promise<GscPullResult> {
  const site = await prisma.site.findUniqueOrThrow({ where: { id: siteId } });
  if (!site.gscSiteUrl) {
    return { ok: false, reason: "missing_site_url", message: "Site has no gscSiteUrl configured." };
  }

  const authResult = getGoogleServiceAccountAuth(["https://www.googleapis.com/auth/webmasters.readonly"]);
  if (!authResult.ok) return authResult;

  const searchconsole = google.searchconsole({ version: "v1", auth: authResult.auth });

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  try {
    const res = await searchconsole.searchanalytics.query(
      {
        siteUrl: site.gscSiteUrl,
        requestBody: {
          startDate: fmt(startDate),
          endDate: fmt(endDate),
          dimensions: ["date", "page", "query", "device", "country"],
          rowLimit: 25000,
        },
      },
      { timeout: 30_000 }
    );

    const rows = (res.data.rows ?? []) as GscRow[];

    await prisma.$transaction([
      prisma.gscMetric.deleteMany({ where: { siteId, date: { gte: startDate } } }),
      prisma.gscMetric.createMany({
        data: rows.map((r) => ({
          siteId,
          date: new Date(r.keys[0]),
          page: r.keys[1],
          query: r.keys[2],
          device: r.keys[3],
          country: r.keys[4],
          clicks: r.clicks,
          impressions: r.impressions,
          ctr: r.ctr,
          position: r.position,
        })),
      }),
    ]);

    return { ok: true, rowCount: rows.length };
  } catch (err) {
    return { ok: false, reason: "api_error", message: err instanceof Error ? err.message : String(err) };
  }
}
