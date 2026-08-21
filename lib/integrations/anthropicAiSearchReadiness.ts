/**
 * Phase N: AI Search Readiness — scores how citeable/extractable a
 * page's content is for AI Overviews, ChatGPT, and similar answer
 * engines. Not a claim of measuring actual AI-citation rankings (that
 * needs a paid tracking service like Otterly.ai/Peec AI) — this scores
 * the on-page signals that make citation more likely.
 *
 * Applies every lesson learned from the Phase H content-review
 * integration: compact single-line JSON output (avoids the model
 * dropping its final closing brace on verbose multi-line output), a
 * brace-repair fallback, a real request timeout, and enough max_tokens
 * headroom that a real page's output shouldn't come close to the ceiling.
 */
const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `You audit a single page's readiness to be cited by AI answer engines (Google AI Overviews, ChatGPT, Perplexity) for a local medical aesthetics/wellness business, against these dimensions:

- entityClarity: can an AI system tell, just from this page's content, what business this is, what service/topic the page covers, and where it's located (city/service area)? Vague or generic pages score low.
- citationReadiness: does the content contain concise, factual, attributable statements (specific claims, named entities, dates, credentials, evidence) that an AI system could confidently quote or paraphrase? Vague marketing language without concrete facts scores low.
- extractability: are there clean, self-contained passages (a clear definition, a direct explanation, a structured list) that could be lifted as a standalone answer, versus content that's only meaningful in the context of surrounding paragraphs?
- hasAnswerBlock: true only if the page contains a direct 40-80 word answer to a "What is X?" / "How does X work?" style question for its main topic, near the top of the content. false otherwise.

Score entityClarity, citationReadiness, and extractability each 0-100. If a dimension scores below 70, include a SHORT "issue" (under 25 words) explaining specifically what's missing — be concrete, not generic. If 70 or above, issue is null.

Respond with ONLY valid, COMPACT JSON on a single line — no markdown fences, no commentary, no pretty-printing/indentation/newlines inside the JSON, exactly this shape:
{"entityClarity":{"score":N,"issue":"..."|null},"citationReadiness":{"score":N,"issue":"..."|null},"extractability":{"score":N,"issue":"..."|null},"hasAnswerBlock":true|false}`;

export interface AiSearchReadinessScores {
  entityClarity: { score: number; issue: string | null };
  citationReadiness: { score: number; issue: string | null };
  extractability: { score: number; issue: string | null };
  hasAnswerBlock: boolean;
}

export type AiSearchReadinessResult =
  | { ok: true; scores: AiSearchReadinessScores }
  | { ok: false; reason: "missing_api_key" | "api_error" | "parse_error"; message: string };

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return (fenced ? fenced[1] : text).trim();
}

function repairUnbalancedBraces(json: string): string {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (const ch of json) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
  }

  return depth > 0 ? json + "}".repeat(depth) : json;
}

export async function reviewAiSearchReadiness(url: string, pageType: string, h1: string | null, visibleText: string): Promise<AiSearchReadinessResult> {
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
        max_tokens: 1200,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `URL: ${url}\nPage type: ${pageType}\nH1: ${h1 ?? "(none)"}\n\nVisible content:\n${visibleText.slice(0, 4000)}`,
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
      const scores = JSON.parse(extractJson(text)) as AiSearchReadinessScores;
      return { ok: true, scores };
    } catch {
      try {
        const repaired = repairUnbalancedBraces(extractJson(text));
        const scores = JSON.parse(repaired) as AiSearchReadinessScores;
        return { ok: true, scores };
      } catch {
        return {
          ok: false,
          reason: "parse_error",
          message: `stop_reason=${json.stop_reason ?? "unknown"}, output_tokens=${json.usage?.output_tokens ?? "?"}. Full text: ${text}`,
        };
      }
    }
  } catch (err) {
    return { ok: false, reason: "api_error", message: err instanceof Error ? err.message : String(err) };
  }
}
