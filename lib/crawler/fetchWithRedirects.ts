/**
 * Plain fetch() auto-follows redirects and hides the chain entirely —
 * you only ever see the final destination. Manually following redirects
 * (redirect: "manual") is what makes redirect-chain and redirect-loop
 * findings possible at all.
 */
const USER_AGENT = "OmniSEOBot/1.0 (+internal audit tool for omnicenters.com)";
const MAX_HOPS = 10;
const RETRY_BACKOFFS_MS = [3000, 6000, 12000];

export interface RedirectHop {
  url: string;
  status: number;
}

export interface FetchResult {
  finalUrl: string;
  finalStatus: number;
  html: string;
  chain: RedirectHop[]; // includes the final hop
  loop: boolean;
  tooManyRedirects: boolean;
  xRobotsTag: string | null;
}

// A hung request on one page must not stall an entire multi-hundred-page
// crawl indefinitely — the existing try/catch in fetchWithRedirects
// already treats a thrown fetch error as "this page failed" (status 0),
// so a timeout here degrades gracefully rather than needing new handling.
const REQUEST_TIMEOUT_MS = 20_000;

async function fetchOnce(url: string): Promise<Response> {
  let res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, redirect: "manual", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  for (const fallbackBackoffMs of RETRY_BACKOFFS_MS) {
    if (res.status !== 429 && res.status !== 503) break;
    const retryAfterHeader = Number(res.headers.get("retry-after"));
    const backoffMs = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0 ? retryAfterHeader * 1000 : fallbackBackoffMs;
    await new Promise((r) => setTimeout(r, backoffMs));
    res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, redirect: "manual", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  }
  return res;
}

export async function fetchWithRedirects(startUrl: string): Promise<FetchResult> {
  const chain: RedirectHop[] = [];
  const visited = new Set<string>();
  let currentUrl = startUrl;

  for (let hop = 0; hop < MAX_HOPS; hop++) {
    if (visited.has(currentUrl)) {
      chain.push({ url: currentUrl, status: 0 });
      return { finalUrl: currentUrl, finalStatus: 0, html: "", chain, loop: true, tooManyRedirects: false, xRobotsTag: null };
    }
    visited.add(currentUrl);

    let res: Response;
    try {
      res = await fetchOnce(currentUrl);
    } catch {
      chain.push({ url: currentUrl, status: 0 });
      return { finalUrl: currentUrl, finalStatus: 0, html: "", chain, loop: false, tooManyRedirects: false, xRobotsTag: null };
    }

    chain.push({ url: currentUrl, status: res.status });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) {
        return { finalUrl: currentUrl, finalStatus: res.status, html: "", chain, loop: false, tooManyRedirects: false, xRobotsTag: null };
      }
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    const html = await res.text();
    return {
      finalUrl: currentUrl,
      finalStatus: res.status,
      html,
      chain,
      loop: false,
      tooManyRedirects: false,
      xRobotsTag: res.headers.get("x-robots-tag"),
    };
  }

  return { finalUrl: currentUrl, finalStatus: 0, html: "", chain, loop: false, tooManyRedirects: true, xRobotsTag: null };
}
