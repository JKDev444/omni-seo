/**
 * Search Console URL Inspection API — what Google actually says about a
 * URL's index status, per-URL (no bulk endpoint; quota is 2000/day and
 * 600/minute per property, plenty for a single-site crawl). Same service
 * account access as gsc.ts, same googleapis client.
 */
import { google } from "googleapis";
import { getGoogleServiceAccountAuth } from "./googleServiceAccount";
import { prisma } from "@/lib/db";
import { createFindingRecord } from "@/lib/findings/createFinding";
import { ReconciliationTracker } from "@/lib/findings/autoResolveFixedFindings";

export interface RichResultsIssue {
  richResultType: string;
  itemName: string | null;
  severity: string | null;
  issueMessage: string | null;
}

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
      richResultsVerdict: string | null;
      richResultsIssues: RichResultsIssue[];
    }
  | { ok: false; reason: "missing_credentials" | "invalid_credentials" | "missing_site_url" | "api_error"; message: string };

/** URLs are equivalent for canonical-comparison purposes modulo a trailing slash (Google treats "example.com" and "example.com/" as the same URL). */
function urlsEquivalent(a: string, b: string): boolean {
  const strip = (u: string) => u.replace(/\/$/, "");
  return strip(a) === strip(b);
}

/** Buckets Google's raw verdict/coverage/indexing fields into the counts the UI shows. */
export function normalizeStatus(params: {
  indexingState: string | null;
  verdict: string | null;
  coverageState: string | null;
  googleCanonical: string | null;
  userCanonical: string | null;
}): string {
  const { indexingState, verdict, coverageState, googleCanonical, userCanonical } = params;

  // INDEXING_STATE_UNSPECIFIED means Google hasn't evaluated this URL yet
  // (typically: newly discovered, not yet crawled) -- a genuinely different
  // situation from a deliberate block (BLOCKED_BY_META_TAG,
  // BLOCKED_BY_ROBOTS_TXT, etc). Lumping them together as "Blocked" turned
  // "Google hasn't gotten to this new page yet" (expected, no action
  // needed) into a false alarm indistinguishable from a real noindex bug.
  if (indexingState && indexingState !== "INDEXING_ALLOWED" && indexingState !== "INDEXING_STATE_UNSPECIFIED") {
    return "Blocked";
  }

  if (verdict === "PASS") {
    if (googleCanonical && userCanonical && !urlsEquivalent(googleCanonical, userCanonical)) return "Canonical Mismatch";
    return "Indexed";
  }

  const state = (coverageState ?? "").toLowerCase();
  if (state.includes("unknown to google")) return "Not Yet Discovered";
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

    // Same API call, same quota -- Google's own Rich Results eligibility
    // verdict is right alongside indexStatusResult in the same response,
    // so this needed no separate integration (contrary to the original
    // scoping note that assumed it would).
    const richResults = res.data.inspectionResult?.richResultsResult;
    const richResultsVerdict = richResults?.verdict ?? null;
    const richResultsIssues: RichResultsIssue[] = (richResults?.detectedItems ?? []).flatMap((group) =>
      (group.items ?? []).flatMap((item) =>
        (item.issues ?? []).map((issue) => ({
          // Google's API sometimes returns an empty string (not null) for
          // richResultType on certain issue categories -- confirmed live,
          // not a parsing bug -- so `?? "fallback"` alone doesn't catch it.
          richResultType: group.richResultType || "Structured data",
          itemName: item.name ?? null,
          severity: issue.severity ?? null,
          issueMessage: issue.issueMessage ?? null,
        }))
      )
    );

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
      richResultsVerdict,
      richResultsIssues,
    };
  } catch (err) {
    return { ok: false, reason: "api_error", message: err instanceof Error ? err.message : String(err) };
  }
}

/** Inspects every currently-known page for a site, respecting the API's per-minute quota. */
export async function inspectAllPages(
  siteId: string
): Promise<{ ok: boolean; inspected: number; errors: number; errorDetails: { url: string; message: string }[]; findingsCreated: number; message?: string }> {
  const pages = await prisma.page.findMany({ where: { siteId }, select: { id: true, url: true } });
  const latestCrawl = await prisma.crawl.findFirst({ where: { siteId, status: "completed" }, orderBy: { startedAt: "desc" } });
  let inspected = 0;
  let errors = 0;
  let findingsCreated = 0;
  const errorDetails: { url: string; message: string }[] = [];
  const tracker = new ReconciliationTracker();

  for (const { id: pageId, url } of pages) {
    const result = await inspectUrl(siteId, url);
    if (!result.ok) {
      if (result.reason === "missing_credentials" || result.reason === "missing_site_url") {
        return { ok: false, inspected, errors, errorDetails, findingsCreated, message: result.message };
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
        richResultsVerdict: result.richResultsVerdict,
        richResultsIssues: JSON.parse(JSON.stringify(result.richResultsIssues)),
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
        richResultsVerdict: result.richResultsVerdict,
        richResultsIssues: JSON.parse(JSON.stringify(result.richResultsIssues)),
      },
    });
    inspected++;

    // Only ERROR severity actually blocks the rich result (per Google's
    // own field doc: "Items with an issue of status ERROR cannot appear
    // with rich result features in Google Search results") -- WARNING
    // issues don't block eligibility, so they're not worth a Finding.
    if (latestCrawl) {
      const errorIssues = result.richResultsIssues.filter((i) => i.severity === "ERROR");
      tracker.markEvaluated(pageId, "Rich Results Eligibility");

      const byType = new Map<string, RichResultsIssue[]>();
      for (const issue of errorIssues) {
        const list = byType.get(issue.richResultType) ?? [];
        list.push(issue);
        byType.set(issue.richResultType, list);
      }

      for (const [richResultType, issues] of byType) {
        const messages = [...new Set(issues.map((i) => i.issueMessage).filter((m): m is string => m !== null))];
        const finding = {
          category: "schema" as const,
          checkStep: "Rich Results Eligibility",
          title: `${richResultType} rich result ineligible: ${messages[0] ?? "structured data error"}`,
          description: `Google's own Rich Results test found ${issues.length} error${issues.length > 1 ? "s" : ""} preventing this page's ${richResultType} structured data from showing as a rich result: ${messages.join("; ")}.`,
          fixType: `Fix the ${richResultType} structured data per Google's Rich Results Test (search.google.com/test/rich-results) for this URL.`,
          priority: "MEDIUM" as const,
          fixLocation: "Theme Liquid" as const,
        };
        await createFindingRecord(latestCrawl.id, pageId, finding);
        tracker.markCreated({ pageId, category: finding.category, checkStep: finding.checkStep, title: finding.title });
        findingsCreated++;
      }
    }

    // Stay well under the 600/minute quota — 10/sec is already generous for a single site.
    await new Promise((r) => setTimeout(r, 150));
  }

  if (latestCrawl) await tracker.resolveFixedFindings(siteId);

  return { ok: true, inspected, errors, errorDetails, findingsCreated };
}
