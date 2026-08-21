/**
 * Chrome UX Report (CrUX) API — real-user field data, the metric that
 * actually matters for ranking (confirmed: PSI/Lighthouse is lab data on
 * top of the same CrUX numbers, not a separate signal). Plain API key,
 * no OAuth/service account. Per-URL data requires enough real Chrome
 * traffic to that exact URL; falls back to origin-level data (still real
 * field data, just less specific) when a URL doesn't have enough.
 */
const CRUX_ENDPOINT = "https://chromeuxreport.googleapis.com/v1/records:queryRecord";

export type FormFactor = "PHONE" | "DESKTOP";
export type Rating = "good" | "needs-improvement" | "poor";

export interface CruxMetrics {
  lcpMs: number | null;
  lcpRating: Rating | null;
  inpMs: number | null;
  inpRating: Rating | null;
  cls: number | null;
  clsRating: Rating | null;
  isOriginFallback: boolean;
}

export type CruxResult =
  | { ok: true; metrics: CruxMetrics }
  | { ok: false; reason: "missing_api_key" | "no_data" | "api_error"; message: string };

function ratingFor(metric: "lcp" | "inp" | "cls", value: number): Rating {
  const thresholds = { lcp: [2500, 4000], inp: [200, 500], cls: [0.1, 0.25] }[metric];
  if (value <= thresholds[0]) return "good";
  if (value <= thresholds[1]) return "needs-improvement";
  return "poor";
}

interface CruxApiHistogramMetric {
  percentiles?: { p75?: number };
}

async function queryCrux(body: Record<string, unknown>, apiKey: string): Promise<Response> {
  return fetch(`${CRUX_ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
}

function parseMetrics(record: Record<string, CruxApiHistogramMetric>, isOriginFallback: boolean): CruxMetrics {
  const lcpMs = record.largest_contentful_paint?.percentiles?.p75 ?? null;
  const inpMs = record.interaction_to_next_paint?.percentiles?.p75 ?? null;
  const cls = record.cumulative_layout_shift?.percentiles?.p75 ?? null;

  return {
    lcpMs,
    lcpRating: lcpMs !== null ? ratingFor("lcp", lcpMs) : null,
    inpMs,
    inpRating: inpMs !== null ? ratingFor("inp", inpMs) : null,
    cls,
    clsRating: cls !== null ? ratingFor("cls", cls) : null,
    isOriginFallback,
  };
}

export async function fetchCruxData(url: string, formFactor: FormFactor): Promise<CruxResult> {
  const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: "missing_api_key", message: "GOOGLE_PAGESPEED_API_KEY is not set." };
  }

  try {
    const urlRes = await queryCrux({ url, formFactor }, apiKey);
    if (urlRes.ok) {
      const data = await urlRes.json();
      return { ok: true, metrics: parseMetrics(data.record.metrics, false) };
    }
    if (urlRes.status !== 404) {
      const body = await urlRes.text();
      return { ok: false, reason: "api_error", message: `CrUX API returned ${urlRes.status}: ${body.slice(0, 300)}` };
    }

    // No per-URL data — fall back to origin-level (still real field data).
    const origin = new URL(url).origin;
    const originRes = await queryCrux({ origin, formFactor }, apiKey);
    if (!originRes.ok) {
      if (originRes.status === 404) {
        return { ok: false, reason: "no_data", message: "No CrUX data for this URL or its origin (not enough real-user traffic)." };
      }
      const body = await originRes.text();
      return { ok: false, reason: "api_error", message: `CrUX API returned ${originRes.status}: ${body.slice(0, 300)}` };
    }
    const originData = await originRes.json();
    return { ok: true, metrics: parseMetrics(originData.record.metrics, true) };
  } catch (err) {
    return { ok: false, reason: "api_error", message: err instanceof Error ? err.message : String(err) };
  }
}
