/**
 * LLM-generated title/meta rewrite suggestions for CTR-opportunity pages
 * (see lib/data/keywordAnalysis.ts's detectCtrOpportunities) — pages with
 * real impressions and a decent position but underperforming CTR, where a
 * better title/meta is the highest-leverage fix. Same cost-aware pattern
 * as anthropicContentReview.ts: a real per-page API call, so this is
 * opt-in and cached per URL, not run on every page load.
 */
const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `You write high-CTR title tags and meta descriptions for a local medical aesthetics/wellness clinic (Omni Centers, Tumwater/Olympia/Lacey WA area). You're given a page that already ranks reasonably well in Google for a specific query but gets far fewer clicks than that position should earn — the title/meta isn't compelling searchers to click.

Write a replacement title tag and meta description that:
- Lead with the actual service/topic matching the query's intent
- Include a concrete, specific hook (price transparency, timeframe, "near me"/city name, a real differentiator) — not generic filler like "learn more" or "discover the benefits"
- Title: 50-60 characters (hard cap 60)
- Meta description: 140-155 characters (hard cap 155), includes a clear next step (book/call/schedule)
- Stay factually accurate to the current title/meta and page topic — do not invent claims, pricing, or credentials not implied by the existing content
- Sound like a real business, not an SEO template — no "Best X in Y | Z" keyword-stuffing pattern

Respond with ONLY valid JSON, no markdown fences, no commentary, exactly this shape:
{"suggestedTitle":"...","suggestedMetaDesc":"...","rationale":"one sentence, under 25 words, explaining the specific change and why it should improve CTR"}`;

export interface CtrRewriteResult {
  suggestedTitle: string;
  suggestedMetaDesc: string;
  rationale: string;
}

export type CtrRewriteApiResult =
  | { ok: true; result: CtrRewriteResult }
  | { ok: false; reason: "missing_api_key" | "api_error" | "parse_error"; message: string };

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return (fenced ? fenced[1] : text).trim();
}

export async function generateCtrRewrite(
  url: string,
  query: string,
  currentTitle: string | null,
  currentMetaDesc: string | null,
  ctr: number,
  avgPosition: number,
  impressions: number
): Promise<CtrRewriteApiResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: "missing_api_key", message: "ANTHROPIC_API_KEY is not set." };
  }

  try {
    const res = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 800,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `URL: ${url}\nTop query: "${query}"\nCurrent avg position: ${avgPosition} (ranking, but underperforming)\nCurrent CTR: ${ctr}% on ${impressions} impressions\nCurrent title tag: ${currentTitle ?? "(none)"}\nCurrent meta description: ${currentMetaDesc ?? "(none)"}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const body = await res.text();
      return { ok: false, reason: "api_error", message: `Anthropic API returned ${res.status}: ${body.slice(0, 300)}` };
    }

    const json = await res.json();
    const text = json.content?.[0]?.text ?? "";

    try {
      const result = JSON.parse(extractJson(text)) as CtrRewriteResult;
      return { ok: true, result };
    } catch {
      return { ok: false, reason: "parse_error", message: `Could not parse model response as JSON: ${text.slice(0, 300)}` };
    }
  } catch (err) {
    return { ok: false, reason: "api_error", message: err instanceof Error ? err.message : String(err) };
  }
}
