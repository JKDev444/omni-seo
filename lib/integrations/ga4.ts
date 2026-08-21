/**
 * GA4 Data API — pulls sessions/users/engaged sessions/conversions by
 * date, page, channel group, and device category.
 */
import { google } from "googleapis";
import { getGoogleServiceAccountAuth } from "./googleServiceAccount";
import { prisma } from "@/lib/db";

export type Ga4PullResult =
  | { ok: true; rowCount: number }
  | { ok: false; reason: "missing_credentials" | "invalid_credentials" | "missing_property_id" | "api_error"; message: string };

export async function pullGa4Metrics(siteId: string, days = 90): Promise<Ga4PullResult> {
  const site = await prisma.site.findUniqueOrThrow({ where: { id: siteId } });
  if (!site.ga4PropertyId) {
    return { ok: false, reason: "missing_property_id", message: "Site has no ga4PropertyId configured." };
  }

  const authResult = getGoogleServiceAccountAuth(["https://www.googleapis.com/auth/analytics.readonly"]);
  if (!authResult.ok) return authResult;

  const analyticsdata = google.analyticsdata({ version: "v1beta", auth: authResult.auth });

  try {
    const propertyResource = site.ga4PropertyId.startsWith("properties/") ? site.ga4PropertyId : `properties/${site.ga4PropertyId}`;

    const res = await analyticsdata.properties.runReport(
      {
        property: propertyResource,
        requestBody: {
          dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
          dimensions: [
            { name: "date" },
            { name: "pagePath" },
            { name: "sessionDefaultChannelGroup" },
            { name: "deviceCategory" },
          ],
          metrics: [
            { name: "sessions" },
            { name: "activeUsers" },
            { name: "engagedSessions" },
            { name: "conversions" },
          ],
          limit: "25000",
        },
      },
      { timeout: 30_000 }
    );

    const rows = res.data.rows ?? [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const parsed = rows.map((row) => {
      const [dateStr, page, channelGroup, deviceCategory] = (row.dimensionValues ?? []).map((v) => v.value ?? "");
      const [sessions, users, engagedSessions, conversions] = (row.metricValues ?? []).map((v) => Number(v.value ?? 0));
      const year = dateStr.slice(0, 4);
      const month = dateStr.slice(4, 6);
      const day = dateStr.slice(6, 8);
      return {
        siteId,
        date: new Date(`${year}-${month}-${day}`),
        page,
        channelGroup,
        deviceCategory,
        sessions,
        users,
        engagedSessions,
        conversions,
        source: "GA4",
      };
    });

    await prisma.$transaction([
      prisma.ga4Metric.deleteMany({ where: { siteId, date: { gte: startDate } } }),
      prisma.ga4Metric.createMany({ data: parsed }),
    ]);

    return { ok: true, rowCount: parsed.length };
  } catch (err) {
    return { ok: false, reason: "api_error", message: err instanceof Error ? err.message : String(err) };
  }
}
