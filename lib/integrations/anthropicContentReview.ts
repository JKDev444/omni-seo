/**
 * LLM-assisted content quality scoring (Step 3 of the audit methodology).
 * Uses a cheap Claude model — this is a real per-page cost, unlike every
 * other check in this project, so it's opt-in (a separate script, not
 * baked into every crawl) and skips pages whose content hasn't changed
 * since the last analysis (see contentAnalysis.ts's hash check).
 */
const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
export const MODEL = "claude-haiku-4-5-20251001";

export const RUBRIC_SYSTEM_PROMPT = `You are auditing a single page's on-page content quality for a local medical aesthetics/wellness business, against this exact rubric (from the site's audit methodology):

- headingIntent: does the H1 and surrounding content clearly match what someone searching for this page's topic actually wants? Flag vague, generic, or mismatched headings.
- introQuality: do the first 100-200 words answer who/what/where/why and include a clear call to action?
- entityCoverage: does the content naturally cover relevant entities (the specific service, its benefits, risks/candidacy, local area) without keyword stuffing?
- trustSignals: are there credentials, disclaimers, provider/team trust signals, or review proof appropriate for a medical aesthetics business?
- freshness: any signs of outdated pricing, stale dates, expired promotions, or retired service mentions?
- ctaConsistency: is there a clear, consistent call to action (book/call/contact)?

Score each dimension 0-100. If a dimension scores below 70, include a SHORT "issue" (under 25 words) explaining specifically what's missing or wrong — be concrete, not generic ("no mention of aftercare or recovery time" not "content could be better"). If 70 or above, issue is null. Keep every issue brief — you have limited output space across 6 dimensions.

Respond with ONLY valid JSON, no markdown fences, no commentary, exactly this shape:
{"headingIntent":{"score":N,"issue":"..."|null},"introQuality":{"score":N,"issue":"..."|null},"entityCoverage":{"score":N,"issue":"..."|null},"trustSignals":{"score":N,"issue":"..."|null},"freshness":{"score":N,"issue":"..."|null},"ctaConsistency":{"score":N,"issue":"..."|null}}`;

export interface ContentReviewScores {
  headingIntent: { score: number; issue: string | null };
  introQuality: { score: number; issue: string | null };
  entityCoverage: { score: number; issue: string | null };
  trustSignals: { score: number; issue: string | null };
  freshness: { score: number; issue: string | null };
  ctaConsistency: { score: number; issue: string | null };
}

export type ContentReviewResult =
  | { ok: true; scores: ContentReviewScores }
  | { ok: false; reason: "missing_api_key" | "api_error" | "parse_error"; message: string };

export function extractJson(text: string): string {
  // Strip markdown fences if the model adds them despite instructions.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return (fenced ? fenced[1] : text).trim();
}

export async function reviewPageContent(
  url: string,
  pageType: string,
  h1: string | null,
  visibleText: string
): Promise<ContentReviewResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: "missing_api_key", message: "ANTHROPIC_API_KEY is not set." };
  }

  try {
    const res = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        // 800, then 1500, both proved insufficient headroom against real
        // pages — some responses still got cut off mid-JSON even after the
        // first increase.
        max_tokens: 2000,
        temperature: 0,
        system: RUBRIC_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `URL: ${url}\nPage type: ${pageType}\nH1: ${h1 ?? "(none)"}\n\nVisible content:\n${visibleText.slice(0, 4000)}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { ok: false, reason: "api_error", message: `Anthropic API returned ${res.status}: ${body.slice(0, 300)}` };
    }

    const json = await res.json();
    const text = json.content?.[0]?.text ?? "";

    try {
      const scores = JSON.parse(extractJson(text)) as ContentReviewScores;
      return { ok: true, scores };
    } catch {
      return { ok: false, reason: "parse_error", message: `Could not parse model response as JSON: ${text.slice(0, 200)}` };
    }
  } catch (err) {
    return { ok: false, reason: "api_error", message: err instanceof Error ? err.message : String(err) };
  }
}
