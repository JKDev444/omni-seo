/**
 * PageSpeed Insights API — Lighthouse lab diagnostics on top of the same
 * CrUX field data. Same API key as crux.ts. Used specifically for the
 * performance score and top improvement opportunities, since that's what
 * CrUX alone doesn't provide.
 */
const PSI_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

export type PsiStrategy = "mobile" | "desktop";

export interface PsiOpportunity {
  id: string;
  title: string;
  savingsMs: number | null;
}

export interface PsiResult {
  performanceScore: number | null;
  opportunities: PsiOpportunity[];
}

export type PsiPullResult = { ok: true; data: PsiResult } | { ok: false; reason: "missing_api_key" | "api_error"; message: string };

export async function fetchPageSpeedInsights(url: string, strategy: PsiStrategy): Promise<PsiPullResult> {
  const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: "missing_api_key", message: "GOOGLE_PAGESPEED_API_KEY is not set." };
  }

  try {
    const params = new URLSearchParams({ url, strategy, key: apiKey, category: "performance" });
    const res = await fetch(`${PSI_ENDPOINT}?${params.toString()}`);
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, reason: "api_error", message: `PageSpeed Insights API returned ${res.status}: ${body.slice(0, 300)}` };
    }

    const json = await res.json();
    const lighthouse = json.lighthouseResult;
    const performanceScore = lighthouse?.categories?.performance?.score != null ? Math.round(lighthouse.categories.performance.score * 100) : null;

    const audits = lighthouse?.audits ?? {};
    const opportunities: PsiOpportunity[] = Object.values(audits as Record<string, any>)
      .filter((a: any) => a.details?.type === "opportunity" && a.score !== null && a.score < 1)
      .map((a: any) => ({
        id: a.id,
        title: a.title,
        savingsMs: a.details?.overallSavingsMs ?? null,
      }))
      .sort((a, b) => (b.savingsMs ?? 0) - (a.savingsMs ?? 0))
      .slice(0, 5);

    return { ok: true, data: { performanceScore, opportunities } };
  } catch (err) {
    return { ok: false, reason: "api_error", message: err instanceof Error ? err.message : String(err) };
  }
}
