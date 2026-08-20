# Omni SEO — Internal Local SEO Audit Tool

Built for omnicenters.com. Custom crawler + GSC/GA4 integration + dashboard,
replacing SearchAtlas with a purpose-built internal tool per the audit
methodology in the SEO_System reference docs.

## Stack
Next.js (App Router) → GitHub → Vercel (hosting + Cron) → Neon Postgres → NextAuth

## What's built so far
- `prisma/schema.prisma` — full data model (Sites, Pages, Crawls, Findings,
  Scorecard, Citations, Maintenance Tasks, Client Reports, GSC/GA4 cache,
  GBP profile cache)
- `lib/checks/onPageChecks.ts` — Steps 1, 2, 4 audit logic (raw HTML,
  indexability, schema-by-page-type) straight from Exact_Audit_Methodology.md
- `lib/crawler/crawl.ts` — the crawler: robots.txt respect (properly scoped
  by User-agent), sitemap discovery, rate-limit-safe fetching with retry/
  backoff, duplicate-title detection across the whole site
- `lib/localSeo/` — Step 5 NAP consistency check (footer vs. schema vs. GBP)
- `lib/integrations/places.ts` — GBP public data pull via Places API
- `lib/citations/`, `lib/maintenance/` — Citation Tracker and Monthly
  Maintenance defaults, sourced exactly from docs/SEO_System/
- `app/(app)/dashboard/` — dashboard UI (health rings, findings, scorecard,
  citation tracker, maintenance tracker)
- `auth.ts`, `auth.config.ts`, `middleware.ts`, `app/login/` — NextAuth
  username/password login (Credentials provider). No public signup route —
  `scripts/createUser.ts` is the only way to create an account, so the
  `User` table is the allowlist. `auth.config.ts` is a deliberately
  Prisma-free config shared with `middleware.ts`, since Vercel's Edge
  Runtime (where middleware runs) can't run Prisma Client.
- `styles/tokens.css` — design system (brand-anchored palette, type scale)

## What's next
See the phased roadmap (Phases 2-7: content depth, image/CWV, platform/
e-commerce checks, GSC+GA4+GBP live data, guided roadmap & reporting,
automation) — ask Claude for the current phase status.

---

## Setup checklist (do these in order)

### 1. Create a GitHub repo
- github.com → New repository → name it `omni-seo` → private
- Push this code once you have it locally (I'll hand you the full repo
  when the build is further along, or we can do this incrementally)

### 2. Create a Neon Postgres database (free tier)
- neon.tech → New Project → copy the connection string
- This becomes your `DATABASE_URL` environment variable

### 3. Create a Vercel account and connect the GitHub repo
- vercel.com → Import Project → select the `omni-seo` repo
- Add environment variables: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
- Deploy, then create a login account: `npx tsx scripts/createUser.ts <email> <password>`
  (run locally against the production `DATABASE_URL`, or via `vercel exec` —
  there's no signup UI on purpose)

### 4. Google Cloud (only needed later, for GSC/GA4/GBP data — not login)
- console.cloud.google.com → New Project → name it "Omni SEO Tool"
- Enable APIs as each integration phase needs them: **Search Console API**,
  **Google Analytics Data API**, **Places API (New)**
- GSC + GA4 will use a **service account** (no OAuth consent screen needed —
  add the service account's email as a user on the Search Console property
  and the GA4 property directly)
- GBP (Business Profile API) needs a one-time OAuth grant from whoever
  manages the actual listing, and separate Google approval for API access

### 5. Point a subdomain (optional, e.g. seo.omnicenters.com)
- In wherever your DNS is managed, add a CNAME record pointing to
  `cname.vercel-dns.com`, then add the domain in Vercel's project settings

### 6. Set up the Vercel Cron job for scheduled crawls
- `vercel.json` will define the schedule (weekly, matching your Week 1
  Technical Crawl cadence) — added once the crawl API route is built

---

## Local development
```bash
npm install
npm run db:push                                        # sync Prisma schema to your database
npx tsx scripts/createUser.ts you@example.com password  # create a login account
npm run dev                                             # starts local server at localhost:3000
```

## Environment variables needed
```
DATABASE_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
```
