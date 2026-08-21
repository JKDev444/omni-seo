# Omni SEO — Internal Local SEO Audit Tool

Built for omnicenters.com (medical aesthetics/wellness clinic, Tumwater/
Olympia/Lacey WA), replacing SearchAtlas ($99/mo) with a purpose-built
internal tool. Custom crawler + live GSC/GA4/DataForSEO/Anthropic
integrations + a multi-page dashboard, following the audit methodology in
`docs/SEO_System/` (gitignored reference material, not app content).

**This file is the up-to-date technical status of the app** — kept current
after every phase so it can be dropped into another tool (ChatGPT, Lovable,
a new Claude session) to get oriented fast. If you're reading this to get
context: this is the whole picture as of the last commit.

## Stack
Next.js 15 (App Router) → GitHub (JKDev444/omni-seo) → Vercel (hosting +
Cron) → Neon Postgres → Prisma → NextAuth (Credentials, no OAuth for login)

## Status: Phases A–L complete

| Phase | What it is | Status |
|---|---|---|
| A | Auth (NextAuth Credentials, no public signup) | Live |
| B | Data foundation (crawl snapshots, Finding model, multi-dimensional scoring) | Live |
| C | Technical SEO engine (redirects, canonicals, robots, duplicate titles/meta, thin content) | Live |
| D | GSC + GA4 analytics (`/analytics`) | Live, real data |
| E | Indexation Control Center (`/indexation`) — Google's real index status per URL | Live, real data |
| F | Core Web Vitals (`/performance`) — CrUX field data + PSI lab data | Live (CrUX has no field data for this site — see Known limitations) |
| G | Internal Link Graph (`/internal-links`) | Live, real data |
| H | Content Depth / E-E-A-T, LLM-assisted (`/content`) | Live, real data |
| I | Keyword rank tracking, cannibalization, decay, CTR opportunities (`/keywords`) | Live, real data |
| J | Content Stacks / topical authority (`/content-stacks`) | Live, real data |
| K | Local SEO + GBP performance API | **Skipped for now** — Places API (public GBP data) is live; the separate GBP Performance API (impressions/calls/clicks, review replies) was deliberately not applied for since it's additive, not foundational |
| L | Backlinks + competitor link gap (`/backlinks`) | Live, real data |
| M | Schema Validation Engine | **Partial** — required properties per type, LocalBusiness/Organization @id consistency, and systemic-gap detection (consolidates the same schema gap across 3+ pages into one finding pointing at the shared template, instead of N near-duplicates) are live, part of every crawl. Not built: schema-vs-visible-content mismatch, schema-URL-redirect checks, and full Rich Results Test eligibility (a separate concern from Schema.org validity, needs a new Google API integration) |

Not started: N (AI Search Readiness), O (Shopify/e-commerce specifics), P
(Guided Roadmap), Q (Reporting), R (Automation/Cron/regression detection),
S (Auto-fix/agentic remediation).

## Pages in the app
`/dashboard` (health rings, findings, scorecard, citations, maintenance) ·
`/analytics` (GSC+GA4) · `/indexation` · `/performance` (CWV) ·
`/internal-links` · `/content` (LLM content review) · `/keywords` (rank
tracking + cannibalization + decay + CTR rewrites) · `/content-stacks` ·
`/backlinks` · `/login`

## Integrations and what each needs

| Integration | Env var(s) | Used for |
|---|---|---|
| Neon Postgres | `DATABASE_URL` | Everything |
| NextAuth | `NEXTAUTH_SECRET`, `NEXTAUTH_URL` | Login |
| Google service account | `GOOGLE_SERVICE_ACCOUNT_KEY` (base64 JSON) | GSC search analytics, GSC URL Inspection, GA4 — add the service account's email as a user on the Search Console property and GA4 property directly, no OAuth consent screen |
| PageSpeed Insights + CrUX | `GOOGLE_PAGESPEED_API_KEY` | Core Web Vitals (`/performance`) — same key covers both APIs; both must be enabled in Cloud Console, and the key's API restrictions (if any) must explicitly allow both |
| Places API (New) | `GOOGLE_PLACES_API_KEY` | Public GBP data (rating, reviews, hours, NAP) — `Site.gbpPlaceId` must be set (real Place ID, look it up via `places:searchText`) |
| Anthropic (Claude Haiku) | `ANTHROPIC_API_KEY` | Content review (`/content`), CTR rewrite suggestions, content-stack topic clustering — every call here is a real per-request cost |
| DataForSEO | `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD` | Keyword rank tracking, keyword volume, backlinks — pay-as-you-go, basic auth, real per-request cost |

`Site.dataForSeoLocationCode` (currently `1027784` = Tumwater, WA) and
`Site.dataForSeoLanguageCode` control where rank checks are targeted.

## Manual sync scripts (Vercel Cron will call these once Phase R exists)
```
npx tsx scripts/runCrawl.ts [domain]                    # full crawl — sitemap discovery, on-page checks, internal link graph
npx tsx scripts/syncAnalytics.ts [domain]                # GSC + GA4
npx tsx scripts/runIndexationCheck.ts [domain]           # URL Inspection API for every crawled page
npx tsx scripts/runCoreWebVitalsCheck.ts [domain]        # CrUX (all pages) + PSI (homepage only)
npx tsx scripts/runContentAnalysis.ts [domain] [maxPages] # LLM content review, real API cost
npx tsx scripts/runCtrRewrites.ts [domain]               # LLM title/meta rewrites for CTR-opportunity pages
npx tsx scripts/runContentStackClustering.ts [domain]    # LLM topical clustering, replaces all existing stacks
npx tsx scripts/seedKeywords.ts suggest [domain]         # preview GSC-derived keyword suggestions (no writes)
npx tsx scripts/seedKeywords.ts accept [domain] "phrase" # add specific keywords to tracking
npx tsx scripts/runKeywordRankings.ts [domain]           # live SERP rank check for all active tracked keywords
npx tsx scripts/retryFailedRankings.ts [domain]          # retry only keywords with no ranking data yet
npx tsx scripts/runGbpProfilePull.ts [domain]            # public GBP data via Places API
npx tsx scripts/runBacklinksCheck.ts [domain] [competitor1,competitor2,...]
```

## Known limitations (real, not bugs)
- **No CrUX field data for this site.** omnicenters.com's real-user Chrome
  traffic volume is below CrUX's publish threshold, at both the URL and
  origin level — confirmed directly against the API, not a code issue.
  PSI Lighthouse lab data still works fine (`/performance` homepage score
  + top opportunities).
- **GBP Performance API not connected** (impressions/calls/clicks from the
  GBP listing itself, in-app review replies) — deliberately skipped per
  user decision on 2026-08-21; Places API (public GBP data) covers
  everything else Local SEO needs.
- Competitor set for Phase L is a fixed list of 5 real local competitors
  (dermamedispa.com, rejuvenateolympia.com, skinmvmt.com,
  pearlplasticsurgery.com, olymedspa.com) — algorithmic competitor
  discovery was tried and rejected (surfaced Facebook/Instagram/YouTube,
  not real local competitors).

## Architecture notes worth knowing before changing things
- `auth.config.ts` is deliberately Prisma-free — shared with
  `middleware.ts`, which runs on Vercel's Edge Runtime and can't run
  Prisma Client. `auth.ts` (full config, DB-backed) is Node-runtime only.
- Every external API call in `lib/integrations/` uses
  `AbortSignal.timeout(...)` (or a `timeout` option for `googleapis` SDK
  calls) — a hung request on a bad day should never be able to stall an
  entire crawl or batch job silently. This was a real incident (see git
  history: `fetchWithRedirects.ts` had none until a hardening pass).
- LLM-assisted features (content review, CTR rewrites, content-stack
  clustering) cache their output per URL/page and are only re-run
  explicitly — never on every page load, since each call is a real cost.
- The crawler discovers pages via sitemap.xml first (recursing one level
  into sitemap index files, matched on the URL's *pathname* ending in
  `.xml` — not the raw string, since Shopify's dynamic sub-sitemaps carry
  a query string), falling back to just the homepage if no sitemap
  exists.
- `MAX_PAGES = 200` in `lib/crawler/crawl.ts` is a safety ceiling for the
  current single-domain v1 scope.

## Local development
```bash
npm install
npm run db:push                                        # sync Prisma schema to your database
npx tsx scripts/createUser.ts you@example.com password  # create a login account (no public signup route)
npm run dev                                             # starts local server at localhost:3000
```

## Environment variables (full list)
```
DATABASE_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
ANTHROPIC_API_KEY=
DATAFORSEO_LOGIN=
DATAFORSEO_PASSWORD=
GOOGLE_SERVICE_ACCOUNT_KEY=
GOOGLE_PAGESPEED_API_KEY=
GOOGLE_PLACES_API_KEY=
```
All of the above must also be set in Vercel's project environment
variables for production, separately from local `.env`.

## Deployment
- Push to `main` → Vercel auto-deploys.
- No Cron job wired up yet (Phase R) — all sync scripts above are run
  manually for now.
