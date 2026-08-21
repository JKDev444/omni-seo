/**
 * DataForSEO Backlinks API — Phase L (backlinks + competitor link gap).
 * Same auth/cost model as lib/integrations/dataforseo.ts (a real
 * per-request cost). The domain_intersection endpoint's undocumented
 * "gap-only" syntax couldn't be verified against real behavior (a
 * "-domain" exclusion-prefix guess returned an implausible 0 results), so
 * the gap analysis here is instead a straightforward client-side set
 * difference over each domain's real referring-domains list — verified
 * against real data, not assumed API behavior.
 */
const DATAFORSEO_BASE = "https://api.dataforseo.com/v3";

function authHeader(): string | null {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) return null;
  return "Basic " + Buffer.from(`${login}:${password}`).toString("base64");
}

type DataForSeoResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "missing_credentials" | "api_error" | "task_error"; message: string };

async function post<T>(path: string, body: unknown[]): Promise<DataForSeoResult<T>> {
  const auth = authHeader();
  if (!auth) {
    return { ok: false, reason: "missing_credentials", message: "DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD are not set." };
  }

  try {
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

export interface BacklinkSummary {
  rank: number | null;
  backlinks: number | null;
  referringDomains: number | null;
  referringDomainsNofollow: number | null;
  brokenBacklinks: number | null;
  spamScore: number | null;
  firstSeen: string | null;
}

export async function fetchBacklinkSummary(domain: string): Promise<DataForSeoResult<BacklinkSummary>> {
  const result = await post<Array<Record<string, unknown>>>("/backlinks/summary/live", [{ target: domain }]);
  if (!result.ok) return result;

  const r = result.data?.[0];
  if (!r) return { ok: false, reason: "api_error", message: "No summary data returned." };

  return {
    ok: true,
    data: {
      rank: (r.rank as number) ?? null,
      backlinks: (r.backlinks as number) ?? null,
      referringDomains: (r.referring_domains as number) ?? null,
      referringDomainsNofollow: (r.referring_domains_nofollow as number) ?? null,
      brokenBacklinks: (r.broken_backlinks as number) ?? null,
      spamScore: (r.backlinks_spam_score as number) ?? null,
      firstSeen: (r.first_seen as string) ?? null,
    },
  };
}

export interface ReferringDomain {
  domain: string;
  rank: number | null;
  backlinks: number | null;
}

export async function fetchReferringDomains(domain: string, limit = 1000): Promise<DataForSeoResult<ReferringDomain[]>> {
  const result = await post<Array<{ items?: Array<Record<string, unknown>> }>>("/backlinks/referring_domains/live", [
    { target: domain, limit, order_by: ["rank,desc"] },
  ]);
  if (!result.ok) return result;

  const items = result.data?.[0]?.items ?? [];
  return {
    ok: true,
    data: items.map((i) => ({
      domain: i.domain as string,
      rank: (i.rank as number) ?? null,
      backlinks: (i.backlinks as number) ?? null,
    })),
  };
}
