/**
 * Search Console URL Inspection API — what Google actually says about a
 * URL's index status, per-URL (no bulk endpoint; quota is 2000/day and
 * 600/minute per property, plenty for a single-site crawl). Same service
 * account access as gsc.ts, same googleapis client.
 */
import { google } from "googleapis";
import { getGoogleServiceAccountAuth } from "./googleServiceAccount";
import { prisma } from "@/lib/db";

export type InspectionResult =
  | {
      ok: true;
      normalizedStatus: string;
      verdict: string | null;
      coverageState: string | null;
      robotsTxtState: string | null;
      indexingState: string | null;
      googleCanonical: string | null;
      userCanonical: string | null;
      lastCrawlTime: string | null;
    }
  | { ok: false; reason: "missing_credentials" | "invalid_credentials" | "missing_site_url" | "api_error"; message: string };

/** Buckets Google's raw verdict/coverage/indexing fields into the counts the UI shows. */
export function normalizeStatus(params: {
  indexingState: string | null;
  verdict: string | null;
  coverageState: string | null;
  googleCanonical: string | null;
  userCanonical: string | null;
}): string {
  const { indexingState, verdict, coverageState, googleCanonical, userCanonical } = params;

  if (indexingState && indexingState !== "INDEXING_ALLOWED") return "Blocked";

  if (verdict === "PASS") {
    if (googleCanonical && userCanonical && googleCanonical !== userCanonical) return "Canonical Mismatch";
    return "Indexed";
  }

  const state = (coverageState ?? "").toLowerCase();
  if (state.includes("discovered")) return "Discovered - Not Indexed";
  if (state.includes("crawled")) return "Crawled - Not Indexed";
  return "Not Indexed";
}

export async function inspectUrl(siteId: string, url: string): Promise<InspectionResult> {
  const site = await prisma.site.findUniqueOrThrow({ where: { id: siteId } });
  if (!site.gscSiteUrl) {
    return { ok: false, reason: "missing_site_url", message: "Site has no gscSiteUrl configured." };
  }

  const authResult = getGoogleServiceAccountAuth(["https://www.googleapis.com/auth/webmasters.readonly"]);
  if (!authResult.ok) return authResult;

  const searchconsole = google.searchconsole({ version: "v1", auth: authResult.auth });

  try {
    const res = await searchconsole.urlInspection.index.inspect(
      { requestBody: { inspectionUrl: url, siteUrl: site.gscSiteUrl } },
      { timeout: 30_000 }
    );

    const result = res.data.inspectionResult?.indexStatusResult;
    const verdict = result?.verdict ?? null;
    const coverageState = result?.coverageState ?? null;
    const robotsTxtState = result?.robotsTxtState ?? null;
    const indexingState = result?.indexingState ?? null;
    const googleCanonical = result?.googleCanonical ?? null;
    const userCanonical = result?.userCanonical ?? null;
    const lastCrawlTime = result?.lastCrawlTime ?? null;

    return {
      ok: true,
      normalizedStatus: normalizeStatus({ indexingState, verdict, coverageState, googleCanonical, userCanonical }),
      verdict,
      coverageState,
      robotsTxtState,
      indexingState,
      googleCanonical,
      userCanonical,
      lastCrawlTime,
    };
  } catch (err) {
    return { ok: false, reason: "api_error", message: err instanceof Error ? err.message : String(err) };
  }
}

/** Inspects every currently-known page for a site, respecting the API's per-minute quota. */
export async function inspectAllPages(
  siteId: string
): Promise<{ ok: boolean; inspected: number; errors: number; errorDetails: { url: string; message: string }[]; message?: string }> {
  const pages = await prisma.page.findMany({ where: { siteId }, select: { url: true } });
  let inspected = 0;
  let errors = 0;
  const errorDetails: { url: string; message: string }[] = [];

  for (const { url } of pages) {
    const result = await inspectUrl(siteId, url);
    if (!result.ok) {
      if (result.reason === "missing_credentials" || result.reason === "missing_site_url") {
        return { ok: false, inspected, errors, errorDetails, message: result.message };
      }
      errors++;
      errorDetails.push({ url, message: result.message });
      continue;
    }

    await prisma.urlInspection.upsert({
      where: { siteId_url: { siteId, url } },
      update: {
        normalizedStatus: result.normalizedStatus,
        verdict: result.verdict,
        coverageState: result.coverageState,
        robotsTxtState: result.robotsTxtState,
        indexingState: result.indexingState,
        googleCanonical: result.googleCanonical,
        userCanonical: result.userCanonical,
        lastCrawlTime: result.lastCrawlTime ? new Date(result.lastCrawlTime) : null,
        fetchedAt: new Date(),
      },
      create: {
        siteId,
        url,
        normalizedStatus: result.normalizedStatus,
        verdict: result.verdict,
        coverageState: result.coverageState,
        robotsTxtState: result.robotsTxtState,
        indexingState: result.indexingState,
        googleCanonical: result.googleCanonical,
        userCanonical: result.userCanonical,
        lastCrawlTime: result.lastCrawlTime ? new Date(result.lastCrawlTime) : null,
      },
    });
    inspected++;

    // Stay well under the 600/minute quota — 10/sec is already generous for a single site.
    await new Promise((r) => setTimeout(r, 150));
  }

  return { ok: true, inspected, errors, errorDetails };
}
