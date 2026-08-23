/**
 * DataForSEO — pay-as-you-go SERP + keyword data (Phase I: rank tracking,
 * keyword research, cannibalization/decay support). Basic auth (login +
 * password from the DataForSEO dashboard), no OAuth. Every call here is a
 * real per-request cost, unlike the free/deterministic crawler checks, so
 * callers should be deliberate about how often they run (see
 * lib/data/keywordRanking.ts for the batching/skip logic).
 */
const DATAFORSEO_BASE = "https://api.dataforseo.com/v3";

function authHeader(): string | null {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) return null;
  return "Basic " + Buffer.from(`${login}:${password}`).toString("base64");
}

async function post<T>(path: string, body: unknown[]): Promise<
  { ok: true; data: T } | { ok: false; reason: "missing_credentials" | "api_error" | "task_error"; message: string }
> {
  const auth = authHeader();
  if (!auth) {
    return { ok: false, reason: "missing_credentials", message: "DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD are not set." };
  }

  try {
    // live/advanced SERP calls have hung indefinitely in practice with no
    // response — a hard timeout keeps one slow keyword from stalling an
    // entire batch rank-check run.
    const res = await fetch(`${DATAFORSEO_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: auth },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    const json = await res.json();

    if (!res.ok || json.status_code !== 20000) {
      return { ok: false, reason: "api_error", message: `DataForSEO returned ${json.status_code ?? res.status}: ${json.status_message ?? "unknown error"}` };
    }

    const task = json.tasks?.[0];
    if (!task || task.status_code !== 20000) {
      return { ok: false, reason: "task_error", message: `Task failed: ${task?.status_code} ${task?.status_message ?? "unknown"}` };
    }

    return { ok: true, data: task.result as T };
  } catch (err) {
    return { ok: false, reason: "api_error", message: err instanceof Error ? err.message : String(err) };
  }
}

export interface SerpItem {
  type: string; // organic | local_pack | ai_overview | featured_snippet | etc.
  rank_absolute?: number;
  domain?: string;
  url?: string;
}

export interface SerpCheckResult {
  position: number | null;
  rankingUrl: string | null;
  localPack: boolean;
  aiOverview: boolean;
  serpFeatures: string[];
}

export type DataForSeoResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "missing_credentials" | "api_error" | "task_error"; message: string };

/**
 * Checks live SERP position for a single keyword against a target domain.
 * Uses live/advanced (not the cheaper live/regular) specifically because
 * we need item-type detection for local_pack / ai_overview presence, not
 * just organic rank.
 */
export async function checkKeywordRank(
  keyword: string,
  domain: string,
  locationCode: number,
  languageCode = "en"
): Promise<DataForSeoResult<SerpCheckResult>> {
  const result = await post<Array<{ items?: SerpItem[] }>>("/serp/google/organic/live/advanced", [
    {
      keyword,
      location_code: locationCode,
      language_code: languageCode,
      device: "desktop",
      depth: 30,
    },
  ]);

  if (!result.ok) return result;

  const items = result.data?.[0]?.items ?? [];
  const organicMatch = items.find(
    (item) => item.type === "organic" && item.domain && (item.domain === domain || item.domain === `www.${domain}`)
  );
  const serpFeatures = [...new Set(items.map((i) => i.type))];

  return {
    ok: true,
    data: {
      position: organicMatch?.rank_absolute ?? null,
      rankingUrl: organicMatch?.url ?? null,
      localPack: items.some(
        (item) => item.type === "local_pack" && item.domain && (item.domain === domain || item.domain === `www.${domain}`)
      ),
      aiOverview: serpFeatures.includes("ai_overview"),
      serpFeatures,
    },
  };
}

export interface KeywordVolumeData {
  keyword: string;
  searchVolume: number | null;
  cpc: number | null;
  competition: number | null;
}

export async function fetchKeywordVolume(
  keywords: string[],
  locationCode: number,
  languageCode = "en"
): Promise<DataForSeoResult<KeywordVolumeData[]>> {
  const result = await post<Array<{ keyword: string; search_volume?: number; cpc?: number; competition?: number }>>(
    "/keywords_data/google_ads/search_volume/live",
    [{ keywords, location_code: locationCode, language_code: languageCode }]
  );

  if (!result.ok) return result;

  return {
    ok: true,
    data: (result.data ?? []).map((r) => ({
      keyword: r.keyword,
      searchVolume: r.search_volume ?? null,
      cpc: r.cpc ?? null,
      competition: r.competition ?? null,
    })),
  };
}

export interface KeywordIdeaData {
  keyword: string;
  searchVolume: number | null;
  cpc: number | null;
  competition: number | null;
  competitionLevel: string | null;
  difficulty: number | null;
  intent: string | null;
}

interface KeywordIdeasItem {
  keyword: string;
  keyword_info?: { search_volume?: number; cpc?: number; competition?: number; competition_level?: string };
  keyword_properties?: { keyword_difficulty?: number };
  search_intent_info?: { main_intent?: string };
}

/**
 * Keyword discovery ("keyword planner") — DataForSEO Labs' keyword_ideas
 * endpoint, seeded from a batch of real terms (service page titles/H1s,
 * existing tracked phrases) and returning related keywords the site isn't
 * necessarily targeting yet, with volume/cpc/competition/difficulty/intent.
 * Note: this endpoint's location_code is validated against a different,
 * broader location set than the SERP/rank-check APIs -- a city-level code
 * that works for checkKeywordRank (e.g. Tumwater, WA) returns "Invalid
 * Field: location_code" here. Use a state/country-level code (confirmed
 * working: 2840 = United States).
 */
export async function fetchKeywordIdeas(
  seedKeywords: string[],
  locationCode: number,
  languageCode = "en",
  limit = 100
): Promise<DataForSeoResult<KeywordIdeaData[]>> {
  const result = await post<Array<{ items?: KeywordIdeasItem[] }>>("/dataforseo_labs/google/keyword_ideas/live", [
    { keywords: seedKeywords, location_code: locationCode, language_code: languageCode, limit },
  ]);

  if (!result.ok) return result;

  const items = result.data?.[0]?.items ?? [];
  return {
    ok: true,
    data: items.map((item) => ({
      keyword: item.keyword,
      searchVolume: item.keyword_info?.search_volume ?? null,
      cpc: item.keyword_info?.cpc ?? null,
      competition: item.keyword_info?.competition ?? null,
      competitionLevel: item.keyword_info?.competition_level ?? null,
      difficulty: item.keyword_properties?.keyword_difficulty ?? null,
      intent: item.search_intent_info?.main_intent ?? null,
    })),
  };
}
