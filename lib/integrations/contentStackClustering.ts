/**
 * LLM-assisted topical clustering (Phase J: Topical Authority / Content
 * Stacks). One batch call over every crawled page's URL/title/H1/pageType
 * — cheap (a single request, not per-page) — asking Claude to group pages
 * into per-service content stacks (pillar → service page → supporting
 * articles), mirroring the content-stack framework already used for this
 * site's real content planning. Inferring ~20+ service groupings from raw
 * crawl data isn't reliably rule-based, so this is LLM-assisted rather
 * than a fixed taxonomy.
 */
const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `You are organizing a medical aesthetics/wellness clinic's website pages into topical content stacks — one stack per distinct service or treatment (e.g. "CoolSculpting", "Botox", "Weight Loss / Semaglutide", "Laser Hair Removal"). This mirrors real content-cluster planning: each stack should have a pillar page (the main service page explaining the treatment), and supporting blog articles that go deeper on specific angles (cost, comparisons, aftercare, FAQs) of that same treatment.

Rules:
- Group pages ONLY by shared topic/treatment — do not force unrelated pages into a stack.
- Each stack needs exactly one "pillar" (the main /pages/ service page for that treatment, or the closest equivalent). If a topic has no clear service page, pick the most comprehensive page as pillar and mark the rest as supporting_article.
- "service_page" role: only for other genuinely distinct-but-related /pages/ URLs in the same treatment family (e.g. a men's variant of a treatment) — most stacks will have zero of these, just a pillar plus supporting articles.
- "supporting_article" role: blog posts that clearly discuss the same specific treatment.
- Ignore homepage, about, contact, policy, collection, and product pages entirely — do not put them in any stack.
- A page can belong to at most one stack. Skip pages that don't clearly belong to a named treatment topic.
- Use clear, short topic names (e.g. "Botox", "CoolSculpting", "Laser Hair Removal", "Weight Loss", "PRF Hair Restoration") — not generic labels like "Skincare" unless no more specific grouping applies.

Respond with ONLY valid, COMPACT JSON on a single line — no markdown fences, no commentary, no pretty-printing/indentation/newlines inside the JSON (this keeps the response short enough to fit within the output limit across many pages), exactly this shape:
{"stacks":[{"topic":"...","members":[{"url":"...","role":"pillar"|"service_page"|"supporting_article"}]}]}`;

export interface PageForClustering {
  url: string;
  title: string | null;
  h1: string | null;
  pageType: string;
}

export interface ClusterMember {
  url: string;
  role: "pillar" | "service_page" | "supporting_article";
}

export interface ContentStackCluster {
  topic: string;
  members: ClusterMember[];
}

export type ClusterResult =
  | { ok: true; stacks: ContentStackCluster[] }
  | { ok: false; reason: "missing_api_key" | "api_error" | "parse_error"; message: string };

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return (fenced ? fenced[1] : text).trim();
}

export async function clusterPagesIntoStacks(pages: PageForClustering[]): Promise<ClusterResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: "missing_api_key", message: "ANTHROPIC_API_KEY is not set." };
  }

  const pageList = pages
    .map((p) => `${p.url} | type: ${p.pageType} | title: ${p.title ?? "(none)"} | h1: ${p.h1 ?? "(none)"}`)
    .join("\n");

  try {
    const res = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8000,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: `Pages:\n${pageList}` }],
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      const body = await res.text();
      return { ok: false, reason: "api_error", message: `Anthropic API returned ${res.status}: ${body.slice(0, 300)}` };
    }

    const json = await res.json();
    const text = json.content?.[0]?.text ?? "";

    try {
      const parsed = JSON.parse(extractJson(text)) as { stacks: ContentStackCluster[] };
      return { ok: true, stacks: parsed.stacks };
    } catch {
      return { ok: false, reason: "parse_error", message: `Could not parse model response as JSON: ${text.slice(0, 500)}` };
    }
  } catch (err) {
    return { ok: false, reason: "api_error", message: err instanceof Error ? err.message : String(err) };
  }
}
