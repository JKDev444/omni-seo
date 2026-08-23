/**
 * Phase W: the AI chat assistant ("What are today's tasks for me?").
 * Same direct-fetch pattern as anthropicContentReview.ts, but the
 * output is conversational text, not structured JSON, so none of that
 * file's brace-repair machinery applies here -- there's no JSON to
 * repair.
 *
 * The one rule that matters more here than anywhere else in this
 * project: the assistant must never invent a number. Every other LLM
 * integration scores subjective quality (content depth, AI-readiness);
 * this one answers questions about a real audit's real findings, so a
 * fabricated "you have 12 critical issues" when there are actually 13
 * is a materially worse failure than a fabricated content-quality
 * score. The system prompt is written to make refusing to guess the
 * safe default, not the exception.
 */
const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
export const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `You are the in-app assistant for Omni SEO, an internal SEO audit tool. You answer questions about the site's real SEO findings, health scores, roadmap, and maintenance tasks.

You will be given a JSON data digest below with the ONLY facts you may state. Ground every specific number, finding title, page path, or score in that JSON. If the user asks something the digest doesn't cover (e.g. a specific finding not in the doNowItems list, historical trends, or anything about a different site), say plainly that you don't have that data rather than estimating or guessing — this app's whole purpose is trustworthy SEO data, so a plausible-sounding invented number is a worse answer than "I don't have that."

Keep answers conversational and concise (a few sentences, or a short list for "what should I do" style questions) — this is a chat widget, not a report.`;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export type ChatResult = { ok: true; reply: string } | { ok: false; reason: "missing_api_key" | "api_error"; message: string };

export async function askChat(dataDigest: string, history: ChatMessage[]): Promise<ChatResult> {
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
        max_tokens: 1000,
        temperature: 0,
        system: `${SYSTEM_PROMPT}\n\nCurrent data digest:\n${dataDigest}`,
        messages: history.map((m) => ({ role: m.role, content: m.content })),
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const body = await res.text();
      return { ok: false, reason: "api_error", message: `Anthropic API returned ${res.status}: ${body.slice(0, 300)}` };
    }

    const json = await res.json();
    const text = json.content?.[0]?.text ?? "";
    return { ok: true, reply: text.trim() };
  } catch (err) {
    return { ok: false, reason: "api_error", message: err instanceof Error ? err.message : String(err) };
  }
}
