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

## Status: Phases A–R, T–W complete; F caveated, K/O skipped by choice; S (auto-fix) and Esco onboarding intentionally not started — see "Before you rely on this" below

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
| M | Schema Validation Engine | **Complete** — required properties per type, LocalBusiness/Organization @id consistency, systemic-gap detection (consolidates the same schema gap across 3+ pages into one finding pointing at the shared template, instead of N near-duplicates), schema URL consistency (a page-describing entity's `url`/`mainEntityOfPage` should match that page's real URL — catches stale schema left behind after a URL restructure), schema-vs-visible-content mismatch (FAQPage answers and Service names should actually appear in the page's visible copy, not just the JSON-LD), and Rich Results eligibility (Google's own Rich Results Test verdict — turned out to already be part of the URL Inspection API response already integrated for indexation, so no new Google API was actually needed) are all live |
| P | Guided Roadmap (`/action-plan`) | **Complete** — Do Now / This Month / Ongoing unified action plan, now the post-login landing page, with in-app buttons to mark a finding done/ignored/false-positive (a server action, `lib/actions/findingActions.ts`). Status carries forward across crawls (`lib/findings/createFinding.ts` checks the prior crawl for a matching finding and carries IGNORED/FALSE_POSITIVE/ACCEPTED onto the new one — COMPLETED deliberately does not carry forward, so a still-broken issue resurfaces as a real regression instead of staying hidden). A 30/60/90-day roadmap section (`lib/data/roadmapPlan.ts`) buckets open findings by priority + estimated effort, not priority alone, so quick mechanical fixes don't wait behind slow content work. Every finding card also has an "Exactly where to fix this" expandable with the real Shopify Admin navigation path and steps, keyed off `Finding.fixLocation`'s actual vocabulary (confirmed against live data: Theme Liquid and Content rewrite account for nearly all of it) |

| R | Automation + regression detection | **Complete** — scheduled sync (see Automation section below), regression detection, full SEO change tracking, and the deployment verification gate are all live. `lib/checks/regressionDetection.ts` diffs each crawl's PageSnapshot against the site's previous crawl (title/meta/H1/canonical/schema loss, status code getting worse), consolidating the same regression across 3+ pages into one finding pointing at the likely shared cause. `lib/checks/changeTracking.ts` complements that with the complete audit trail underneath it — every title/meta/canonical/H1/status/schema-type-set change, not just the ones that got worse — viewable at `/change-log`. The deployment verification gate (`/deploy-check`) needed no new staging infrastructure — Shopify's own theme preview URLs (`?preview_theme_id=`) are a real, already-available surface: paste one or more preview URLs, it runs the same checks a real crawl runs and diffs the result against the live production page at the same path |

| N | AI Search Readiness (`/ai-search`) | **Live, real data** — entity clarity, citation readiness, extractability, and direct-answer-block detection per page, LLM-assisted (same pattern as Phase H, with every lesson from it applied from the start — compact JSON, brace-repair, timeout, real max_tokens headroom). Not a claim of measuring actual AI-citation rankings (needs a paid tracking service like Otterly.ai/Peec AI) — scores the on-page signals that make citation more likely. Runs monthly via GitHub Actions alongside the other LLM checks |

| Q | Reporting (`/reports`, real Scorecard) | **Live, real data** — the Scorecard's 5 metrics (`lib/data/scorecardMetrics.ts`) are computed from real data (Technical score reuses the Dashboard's own ring formula; indexed pages from URL Inspection; branded position from GSC; organic sessions from GA4; local pack visibility from KeywordRanking), replacing the original seed script's fabricated placeholder numbers. Baseline freezes on first real computation, `current` updates every run. The monthly client report (`lib/integrations/clientReportGeneration.ts`) is LLM-written from a real data digest — explicitly forbidden from inventing any number, and leads/conversions (no CRM/booking integration exists) is instructed to say so honestly rather than estimate. Scorecard update runs weekly (free); report generation runs monthly (real Anthropic cost) |

**Phase O (Shopify/e-commerce specifics) is deliberately out of scope** —
omnicenters.com is a services business with no products, so product-page
checks (variant duplicate URLs, Merchant Center feed, etc.) don't apply
here.

Not started: S (Auto-fix/agentic remediation) — the long-term "find
issue → generate a fix → open a PR" vision; not started intentionally,
since everything before it should be solid first.

## What's next (v2 scope, added 2026-08-22)
Once the single-site A-S phase list above is solid, the plan is:

| Phase | What it is | Why this order |
|---|---|---|
| T | Multi-Site Support | **Partial** — the architecture is done: `lib/data/activeSite.ts` (cookie-based active-site resolution) replaced every page/data function's hardcoded `V1_DOMAIN`, and a sidebar site switcher (`components/SiteSwitcher.tsx`) appears automatically once more than one site exists. Verified live with a synthetic second site — data isolation, empty-state rendering, and the stale-cookie-after-deletion fallback all confirmed working, then cleaned up. Not done: actually onboarding `esco-pacific.com` as a real second site — needs the user to grant the service account access to Esco's Search Console/GA4 properties first, plus a decision on DataForSEO spend for a second site, before its first real crawl runs |
| U | UI/UX Design Polish | **Complete** — mocked up two visual directions as a design canvas first (see below), user picked "Spacious & Editorial." Rolled out: bigger radii/shadows and solid-fill priority badges (`styles/tokens.css`), a grouped 6-section sidebar nav with real active-page highlighting for the first time (`components/NavLinks.tsx`), and a structural rebuild of the Action Plan page (elevated finding cards with a priority-colored left border, roadmap tiles with SVG progress rings). Because the shared classes changed, every other page inherited the new look automatically — verified live on Dashboard and Indexation too. Mobile navigation (`components/MobileNavShell.tsx`) adds a hamburger-triggered drawer with the same nav, using plain conditional mounting rather than a slide animation — see Known limitations for why |
| V | Change Pacing / Drip-Feed Intelligence | **Complete** — see "Change pacing: what the research actually found" below. Rather than build an algorithm-avoidance scheduler on a premise Google's own statements don't support, implemented ICE (Impact × Confidence ÷ Effort) — the prioritization framework most SEO agencies/tools actually use, explicitly recommended for solo operators. `lib/data/roadmapPlan.ts`'s `computeIceScore()` now orders every list of findings (the 30/60/90 roadmap buckets, and Do Now/This Month/Ongoing) by real expected value instead of detection date, plus a realistic "~N/week keeps this on pace" suggestion per bucket and research-backed cadence notes for content and backlink outreach |
| W | AI Chat Assistant | **Complete** — a floating chat widget on every page (`components/ChatWidget.tsx`), grounded in a real-data digest built from the same `getActionPlanData`/`getDashboardData` functions every other page uses (`lib/data/chatContext.ts`) — never a second source of truth for the same numbers. Verified live: a factual question matched an independently-queried real count exactly, an open-ended "what are today's top tasks" question correctly cited real findings and real maintenance tasks, and a question outside the digest (backlink trends) was correctly declined instead of fabricated |

Tracked in the Project Tracker (`/project-tracker`) alongside everything else.

### Change pacing: what the research actually found

Before designing Phase V, researched what Google itself actually says
about change/backlink pacing rather than building on assumption:

- **Backlink velocity is explicitly not a ranking factor.** Google's
  John Mueller: *"it's not so much a matter of how many links you get
  in which time period... it doesn't really matter how many or in
  which time."* What matters is whether individual links are natural,
  not their acquisition pace. The common SEO-industry belief that
  outreach must be drip-fed to avoid an algorithmic penalty isn't
  well-supported by Google's own statements.
- **Mueller's real reason for splitting site changes over time is
  attribution, not algorithm safety** — *"if you do everything at
  once, you'll never know what to fix."* That's a measurement problem
  this app already has strong infrastructure for: the SEO Change
  Tracking changelog (Phase R, `/change-log`) plus GSC/Scorecard data
  is exactly what's needed to correlate a change with its effect.
- **Crawl budget is a real constraint, but overwhelmingly for large
  sites** — Google's own guidance frames it around sites with very
  large URL counts or very high publish frequency. At ~182 pages,
  omnicenters.com isn't in that risk zone.
- **Google's "scaled content abuse" policy is about volume + low value
  + manipulative intent, not volume alone** — a large site can publish
  thousands of genuinely useful pages and be fine. The technical/schema
  fixes and content-quality improvements this app recommends are
  improvements to real existing pages, not the mass-produced
  low-value-page pattern the policy targets.

**Conclusion:** the phase's original framing ("protect against Google
penalties by drip-feeding") doesn't hold up. Flagged for a decision
before building anything further; the user's call was to apply the
real industry-standard tactic instead of an algorithm-avoidance
scheduler — **ICE (Impact × Confidence ÷ Effort)**, the prioritization
framework most SEO agencies/tools actually use (explicitly recommended
for solo operators specifically, since it needs no special tooling).
`lib/data/roadmapPlan.ts`'s `computeIceScore()` reuses the Impact
weighting the health score already uses (`dashboard.ts`'s
`PRIORITY_WEIGHT`, now exported) and each Finding's own `confidence`
field, divided by the existing quick/medium/long effort tiers — so
every list of findings in the app is now ordered by real expected
value, not by an accident of when a check happened to detect it.
Verified against real data: quick-effort CRITICAL findings score 20.0
and correctly outrank same-priority findings needing more effort
(10.0). A realistic "~N/week keeps this on pace" note per roadmap
bucket and research-backed cadence context for content/backlink
outreach round it out — see Phase V's row above.

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
client report) · `/change-log` (every title/meta/canonical/H1/status/
schema change, crawl over crawl) · `/project-tracker` (phase/task board
for following this app's own build progress — see Project Tracker
section below) · `/login`

A floating chat widget (`components/ChatWidget.tsx`, `/lib/data/chatContext.ts`)
is available on every page — ask it things like "What are today's top
tasks?" or "How many critical issues do I have?" and it answers from
the same real data every other page shows, declining rather than
guessing when a question is outside what it has.

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

## Manual sync scripts
Most of these now also run automatically (see Automation above) — this
list is for one-off backfills, re-runs after a fix, or running something
sooner than its schedule.
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
- **Mobile nav has no slide-in animation.** `components/MobileNavShell.tsx`
  opens/closes the drawer via plain conditional mounting instead of a
  CSS transform + transition. The animated version was built first and
  verified to genuinely not repaint in this project's dev test
  environment (inline style updated correctly on click, confirmed via
  `getAttribute`; `getBoundingClientRect` still reported the closed
  position a full second later) — the same browser pane had separately
  failed a screenshot with "not compositing frames" earlier that
  session, the likely cause. Functionally complete either way (open,
  close via X, close via overlay click, desktop unaffected — all
  verified via real layout measurements); the animation is cosmetic
  polish to revisit once it can be checked with the pane visible.

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

- Backlinks and remaining Local SEO were audited next: Backlinks' gap
  logic (client-side set difference over real DataForSEO referring-domain
  data) checked out on code review. Local SEO turned up one more real
  bug: the Dashboard's Citation Tracker showed a hardcoded, fabricated
  "NAP inconsistent" flag for Google Business Profile with a note
  admitting "Sample data — not a live check" — rendering identically to
  a genuine finding. Fixed by wiring it to the real NAP check
  (`lib/localSeo/runLocalSeoAudit.ts`), same pattern as the Scorecard fix
  above; directories with no real integration now show an honest
  "Unchecked" state instead of invented data.
- Building the Schema URL Consistency check (Phase M) produced a bug of
  its own, caught by the same live-verification habit rather than
  trusting the code once it typechecked: the first version checked
  *every* schema type's `url` against the page's own URL, so
  Organization/WebSite/Person schema — which correctly declare the org's
  homepage, the site root, or an author's bio page, not the current page
  — produced 654 false positives on the first crawl. Restricting it to
  actually self-referencing types (Article, BlogPosting, Product,
  Service, WebPage) dropped that to 28 genuine findings, and 640 of the
  654 false positives auto-resolved to VERIFIED on their own via the
  reconciliation mechanism above — the fix-verify-fix loop working as
  designed, including on new code from the same session.

- Building the schema-vs-content mismatch check and the SEO change log
  (Phase M/R) got the same treatment before committing: the content-
  match check was verified against live pages with curl plus the exact
  `extractVisibleText` logic it uses internally, confirming two sample
  findings (a Service name, an FAQ answer) were genuinely absent from
  the page's visible text, not false positives — 76 findings across 182
  pages, not a flood. The change log's first real crawl logged 0
  changes, which is ambiguous from the outside (nothing changed, or the
  diffing logic is broken) — resolved with a synthetic test: two fake
  snapshots with known field differences, confirmed `logSeoChanges`
  logged exactly the 4 expected changes and correctly ignored the 2
  deliberately-unchanged fields, then deleted the test data.

- Closing out Phase M turned up one more real bug of the same shape:
  Google's own API returned an empty string (not `null`) for
  `richResultType` on some issues, and `?? "Unknown"` doesn't catch an
  empty string — 3 of 5 Rich Results findings shipped with a blank type
  in the title. Fixed with `|| "Structured data"`, re-ran the check,
  confirmed the malformed findings auto-resolved to VERIFIED and were
  replaced by correctly-titled ones. Also worth noting: the Rich Results
  eligibility check itself needed zero new API integration — the
  richResultsResult field was already part of the URL Inspection
  response the app was already calling, just never parsed.

- Closed out the last flagged category, Keywords: sampled real
  cannibalization/decay/CTR output against live GSC data
  (`lib/data/keywordAnalysis.ts`). The cannibalization check itself
  turned out well-calibrated (54 of 58 flagged issues had a genuinely
  meaningful second-page share) — but several of the largest were
  branded/navigational queries ("omni centers" spread across 16 pages),
  real data but not the same actionable problem as a service keyword
  splitting traffic between two competing pages. Added `isBrandedQuery`,
  deriving the brand token from the site's own domain (not hardcoded,
  so it keeps working once a second site is onboarded) — 58 raw matches
  dropped to 50 after excluding exactly the branded ones.

Every original check category has now been sampled against live data at
least once. This doesn't mean the audit is "done" — it's a standing
habit, not a one-time pass — but the initial sweep across every
category is complete as of 2026-08-22.

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
- Vercel Cron and the two GitHub Actions workflows (see Automation
  above) handle ongoing data sync automatically once their secrets are
  configured — see "Before you rely on this" below for the one
  verification step that hasn't been done yet.

## Before you rely on this (verify before launch)
Everything below is real, working code with real data behind it — but
these specific things have not been end-to-end verified yet, because
they only matter once the app runs unattended:

- **The two GitHub Actions workflows have never actually run — 0 runs
  on record**, checked directly against the Actions tab on
  2026-08-23. The code is correct and every script it calls has been
  run manually and produces real data (117 keywords tracked, 122 rank
  checks, 180 content-analysis rows, etc.) — but the *scheduled,
  unattended* path (secrets configured in GitHub → workflow fires on
  schedule → completes within its 60-minute timeout → writes to the
  same production database) has not been proven. **Action needed:**
  add the 7 secrets listed above to GitHub (Settings → Secrets and
  variables → Actions), then trigger each workflow once manually from
  the Actions tab (`workflow_dispatch`) and confirm it finishes green.
  Do this once before trusting the Monday/1st-of-month schedule.
- **Core Web Vitals has only 1 stored data point** — expected, given
  the CrUX threshold issue above, but worth knowing before treating
  `/performance` as fully populated.
- **No keyword *discovery* tool yet** — `/keywords` tracks rank
  position and pulls search volume for keywords you already added (via
  `seedKeywords.ts` or suggestions pulled from queries the site already
  gets impressions for). It does not surface brand-new keyword ideas
  the site doesn't rank for at all — the actual "which keywords are
  worth going after" research step SearchAtlas/Semrush/Ahrefs/Google
  Keyword Planner do. DataForSEO (already integrated) has a Keyword
  Ideas / related-keywords endpoint that isn't wired up yet — see the
  walkthrough for the recommendation on this.
