/**
 * Phase Q: auto-generates the monthly client report the Maintenance
 * SOP's Week 4 task already expects ("Send plain-English client report:
 * wins, remaining issues, next month priorities"). Every number the
 * model is given is real (see clientReportDigest.ts) -- the prompt
 * explicitly forbids inventing anything, especially leads/conversions,
 * since no CRM/booking data is connected to this tool.
 */
import type { ClientReportDigest } from "@/lib/data/clientReportDigest";

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `You write a plain-English monthly SEO report for the owner of a local medical aesthetics/wellness clinic, from real data about their own website. This is not a sales pitch -- write like a knowledgeable person giving a direct, honest update, not marketing copy.

Rules:
- Use ONLY the numbers given to you. Never invent a number, percentage, or claim not present in the data.
- For leadsConversions: the data will say this isn't tracked automatically. Write ONLY a short note that this needs manual numbers from their booking/CRM system -- do not invent or estimate any figure.
- Keep each section to 2-4 short sentences, plain English, no jargon without explanation.
- Be honest about bad news (a low score, more critical issues than last month) as much as good news -- this report is for the site owner's own use, not a client being sold something.

Respond with ONLY valid, COMPACT JSON on a single line -- no markdown fences, no commentary, no pretty-printing/newlines inside the JSON, exactly this shape:
{"technicalHealth":"...","contentImprovements":"...","localSeo":"...","performance":"...","rankingsTraffic":"...","leadsConversions":"...","nextMonthPriorities":"..."}`;

export interface ClientReportSections {
  technicalHealth: string;
  contentImprovements: string;
  localSeo: string;
  performance: string;
  rankingsTraffic: string;
  leadsConversions: string;
  nextMonthPriorities: string;
}

export type ClientReportResult =
  | { ok: true; sections: ClientReportSections }
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

export async function generateClientReport(digest: ClientReportDigest): Promise<ClientReportResult> {
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
        max_tokens: 1500,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: `Real data for ${digest.month}:\n${JSON.stringify(digest, null, 2)}` }],
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
      const sections = JSON.parse(extractJson(text)) as ClientReportSections;
      return { ok: true, sections };
    } catch {
      try {
        const repaired = repairUnbalancedBraces(extractJson(text));
        const sections = JSON.parse(repaired) as ClientReportSections;
        return { ok: true, sections };
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
