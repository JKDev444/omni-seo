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

## Status: Phases A–L, N, Q complete; F caveated, M/P/R partial; K skipped by choice, O out of scope (no products)

**The core intent of this app**: not just a pile of diagnostic reports —
a tool that tells the user everything they need to do, on whatever
cadence, to get SEO to 100%, the way SearchAtlas did. `/action-plan` is
the answer to that: the post-login landing page, pulling every open
Finding plus CTR rewrite suggestions, weak content clusters, backlink
outreach targets, and this month's recurring maintenance tasks into one
prioritized Do Now / This Month / Ongoing view. Every other page still
exists for going deep on one specific thing.

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
| P | Guided Roadmap (`/action-plan`) | **Live** — Do Now / This Month / Ongoing unified action plan, now the post-login landing page, with in-app buttons to mark a finding done/ignored/false-positive (a server action, `lib/actions/findingActions.ts`). Status carries forward across crawls (`lib/findings/createFinding.ts` checks the prior crawl for a matching finding and carries IGNORED/FALSE_POSITIVE/ACCEPTED onto the new one — COMPLETED deliberately does not carry forward, so a still-broken issue resurfaces as a real regression instead of staying hidden). Not built: 30/60/90-day framing, platform-specific exact fix instructions beyond what Finding.fixType already gives |

| R | Automation + regression detection | **Partial** — scheduled sync (see Automation section below) and regression detection are live. `lib/checks/regressionDetection.ts` diffs each crawl's PageSnapshot against the site's previous crawl (title/meta/H1/canonical/schema loss, status code getting worse), consolidating the same regression across 3+ pages into one finding pointing at the likely shared cause. Not built: SEO change tracking (a full changelog of every field change, not just regressions), deployment verification gate |

| N | AI Search Readiness (`/ai-search`) | **Live, real data** — entity clarity, citation readiness, extractability, and direct-answer-block detection per page, LLM-assisted (same pattern as Phase H, with every lesson from it applied from the start — compact JSON, brace-repair, timeout, real max_tokens headroom). Not a claim of measuring actual AI-citation rankings (needs a paid tracking service like Otterly.ai/Peec AI) — scores the on-page signals that make citation more likely. Runs monthly via GitHub Actions alongside the other LLM checks |

| Q | Reporting (`/reports`, real Scorecard) | **Live, real data** — the Scorecard's 5 metrics (`lib/data/scorecardMetrics.ts`) are computed from real data (Technical score reuses the Dashboard's own ring formula; indexed pages from URL Inspection; branded position from GSC; organic sessions from GA4; local pack visibility from KeywordRanking), replacing the original seed script's fabricated placeholder numbers. Baseline freezes on first real computation, `current` updates every run. The monthly client report (`lib/integrations/clientReportGeneration.ts`) is LLM-written from a real data digest — explicitly forbidden from inventing any number, and leads/conversions (no CRM/booking integration exists) is instructed to say so honestly rather than estimate. Scorecard update runs weekly (free); report generation runs monthly (real Anthropic cost) |

**Phase O (Shopify/e-commerce specifics) is deliberately out of scope** —
omnicenters.com is a services business with no products, so product-page
checks (variant duplicate URLs, Merchant Center feed, etc.) don't apply
here.

Not started: S (Auto-fix/agentic remediation) — the long-term "find
issue → generate a fix → open a PR" vision; not started intentionally,
since everything before it should be solid first.

## Automation

Everything used to require manually running a script. Now split across
two mechanisms, by real execution time (Vercel's serverless limit is
300s on Pro, up to 800s with Fluid Compute — this project's real
observed crawl time is 10-25 minutes, which exceeds even that):

- **Vercel Cron** (`vercel.json` → `app/api/cron/sync-fast`, weekly,
  Monday 13:00 UTC): GSC/GA4 sync + GBP profile pull — genuinely fast
  (single-digit seconds). Needs a `CRON_SECRET` env var set in Vercel
  (any random string — Vercel sends it back as `Authorization: Bearer
  <value>` when triggering); the route checks it and rejects anything
  else with 401. **The auth middleware explicitly excludes
  `/api/cron/*`** — without that exclusion the redirect-to-login logic
  intercepts the request before the route's own check ever runs and the
  cron job silently never executes (a real bug caught by testing the
  live endpoint, not just reading the code).
- **GitHub Actions** (`.github/workflows/weekly-seo-sync.yml` +
  `monthly-seo-sync.yml`): everything too slow or too cost-bearing for a
  serverless function — full crawl, indexation check, Core Web Vitals,
  keyword rank checks (weekly); LLM content review, CTR rewrites,
  content-stack clustering, backlinks (monthly, since Anthropic/
  DataForSEO cost real money and this data doesn't meaningfully change
  week to week). GitHub Actions jobs have no comparable timeout.
  **Needs every env var from the list below added as a GitHub repo
  secret** (Settings → Secrets and variables → Actions) — the workflows
  read them via `${{ secrets.NAME }}`. Trigger a run manually anytime
  from the Actions tab (`workflow_dispatch`) without waiting for the
  schedule.

## Pages in the app
`/action-plan` (post-login landing page — the unified Do Now / This
Month / Ongoing plan) · `/dashboard` (health rings, findings, scorecard,
citations, maintenance) · `/analytics` (GSC+GA4) · `/indexation` ·
`/performance` (CWV) · `/internal-links` · `/content` (LLM content
review) · `/ai-search` (AI Search Readiness) · `/keywords` (rank tracking + cannibalization + decay + CTR
rewrites) · `/content-stacks` · `/backlinks` · `/reports` (monthly
client report) · `/project-tracker` (phase/task board for following this
app's own build progress — see Project Tracker section below) · `/login`

The Backlinks, Keywords, and Indexation pages' biggest tables (150, 117,
182+ rows) use `components/FilterableTable.tsx` — a client-side search
box, since scrolling to find one row in a list that size was the app's
most obvious usability gap. Server Components pre-render each row's
cells and a plain search string; the client component only handles
filtering (functions can't cross the Server-to-Client Component
boundary, only data and already-rendered JSX — confirmed by a real crash
when the first version tried).

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

## Project Tracker
`/project-tracker` is a live phase/task board (`ProjectPhase`/`ProjectTask`
models, deliberately separate from `Site`/`Finding` — it tracks this
tool's own development, not a client's SEO) so progress can be followed
without reading git log or README diffs. Seeded via
`scripts/seedProjectTracker.ts` (safe to re-run — the upsert never
overwrites an existing row's status, only adds new phases/tasks).

Task status gets updated from the command line as work lands, not by
hand-editing the UI:
```
npx tsx scripts/markTask.ts task <phaseKey> "<title-substring>" DONE
npx tsx scripts/markTask.ts phase <phaseKey> COMPLETE
npx tsx scripts/markTask.ts add <phaseKey> "<new task title>"
```
The UI also has Mark done/Undo buttons for manual use (same server-action
pattern as the Action Plan's finding buttons).

## Accuracy audit (2026-08-21)
Prompted by a direct question: "is this app properly giving the right SEO
information back after audits?" Rather than more features, this was a
deliberate pass sampling real findings from every check category and
verifying each one against the live site (curl, direct DB queries,
browser) — not just confirming the code runs.

Two real bugs found and fixed as a result:
- **Cross-crawl finding visibility** — Dashboard and Action Plan filtered
  findings by `crawlId: latestCrawl.id`, but LLM-based checks (content
  review, AI Search Readiness) run on their own cadence and attach
  findings to whatever crawl was "latest" *at the time*. Any later crawl
  orphaned those findings off-screen entirely. Fixed with
  `lib/findings/getOpenFindings.ts` — "open" is now defined per distinct
  issue (page + category + checkStep + title), not per crawl. Real impact
  when found: 351 Content Depth findings alone were invisible on both
  pages.
- **Findings never auto-resolving** — the above fix exposed the next
  layer: a finding is only ever created when a check *detects* a problem,
  never when it confirms one is gone, so a genuinely-fixed issue (e.g. a
  canonical tag added back) stayed open forever with nothing to supersede
  it. Confirmed live: `/pages/laser-hair-removal` was still flagged
  "Missing canonical tag" from the very first crawl, days after the tag
  was actually confirmed present on every crawl since. Fixed with
  `lib/findings/autoResolveFixedFindings.ts` (`ReconciliationTracker`) —
  wired into `crawl.ts`, `coreWebVitals.ts`, `contentAnalysis.ts`, and
  `aiSearchReadinessAnalysis.ts`, so any PENDING finding whose
  (page, checkStep) was genuinely re-evaluated this run — and not
  recreated — flips to VERIFIED.
- Also found via the same audit: `classifyPageType()` treated *every*
  URL under `/pages/` as a service page, so content-quality/AI-readiness
  LLM checks ran against Privacy Policy, Terms of Use, Thank You, and
  similar utility pages — producing findings the LLM's own output
  described as "Not applicable." Added a `UTILITY_PAGE` type with a
  slug-based exclusion list, verified against 7 real misclassified URLs.

This is an ongoing exercise, not a one-time pass — the next round should
sample Keywords, Backlinks, and remaining Local SEO findings the same
way.

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
- **Don't run `npm run build` while `npm run dev` is running against the
  same `.next` folder** — dev and prod builds use incompatible structures
  there, and it corrupts the running dev server's module map (real,
  repeated incident this session — symptoms look like
  `Cannot find module './NNN.js'` or `__webpack_modules__[moduleId] is
  not a function`). Fix is always `rm -rf .next` + restart, never a code
  bug when it happens.
- A `qa-test@internal.local` login account exists (created via
  `scripts/createUser.ts`) for browser-based UI verification without
  needing the real account's credentials. Delete it with
  `npx tsx scripts/deleteUser.ts qa-test@internal.local` once it's no
  longer needed, or leave it — it's a normal login account like any
  other, no special privileges.

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
CRON_SECRET=
```
All of the above must also be set in Vercel's project environment
variables for production, separately from local `.env`. The two GitHub
Actions workflows need `DATABASE_URL`, `ANTHROPIC_API_KEY`,
`DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`, `GOOGLE_SERVICE_ACCOUNT_KEY`,
`GOOGLE_PAGESPEED_API_KEY`, and `GOOGLE_PLACES_API_KEY` added as GitHub
repo secrets too (they write directly to the same production database —
`NEXTAUTH_*` and `CRON_SECRET` aren't needed there, since the workflows
don't touch auth or the Vercel Cron route).

## Deployment
- Push to `main` → Vercel auto-deploys.
- No Cron job wired up yet (Phase R) — all sync scripts above are run
  manually for now.
