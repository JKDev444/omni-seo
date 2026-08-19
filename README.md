# Omni SEO — Internal Local SEO Audit Tool

Built for omnicenters.com. Custom crawler + GSC/GA4 integration + dashboard,
replacing SearchAtlas with a purpose-built internal tool per the audit
methodology in the SEO_System reference docs.

## Stack
Next.js (App Router) → GitHub → Vercel (hosting + Cron) → Neon Postgres → NextAuth

## What's built so far (v1 foundation)
- `prisma/schema.prisma` — full data model (Sites, Pages, Crawls, Findings,
  Scorecard, Citations, Maintenance Tasks, Client Reports, GSC/GA4 cache)
- `lib/checks/onPageChecks.ts` — Steps 1-4 audit logic (raw HTML, indexability,
  schema-by-page-type) straight from Exact_Audit_Methodology.md
- `lib/crawler/crawl.ts` — the crawler itself: robots.txt respect, sitemap
  discovery, raw HTML fetch, duplicate-title detection across the whole site
- `styles/tokens.css` — design system (brand-anchored palette, type scale)

## What's next
- Dashboard UI (site health rings, findings list, scorecard, citation tracker)
- GSC + GA4 API integration (`lib/integrations/gsc.ts`, `ga4.ts`)
- Local SEO module (NAP consistency, GBP public data)
- NextAuth login
- Vercel Cron config for scheduled crawls

---

## Setup checklist (do these in order)

### 1. Create a GitHub repo
- github.com → New repository → name it `omni-seo` → private
- Push this code once you have it locally (I'll hand you the full repo
  when the build is further along, or we can do this incrementally)

### 2. Create a Neon Postgres database (free tier)
- neon.tech → New Project → copy the connection string
- This becomes your `DATABASE_URL` environment variable

### 3. Create a Google Cloud project (for GSC + GA4 access)
- console.cloud.google.com → New Project → name it "Omni SEO Tool"
- Enable APIs: **Search Console API** and **Google Analytics Data API**
- Create OAuth 2.0 credentials (OAuth client ID, type: Web application)
  - Authorized redirect URI: `https://your-vercel-domain.vercel.app/api/auth/callback/google`
- Save the Client ID and Client Secret — these become environment variables,
  never committed to the repo

### 4. Create a Vercel account and connect the GitHub repo
- vercel.com → Import Project → select the `omni-seo` repo
- Add environment variables: `DATABASE_URL`, `GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`
- Deploy

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
npm run db:push      # sync Prisma schema to your Neon database
npm run dev           # starts local server at localhost:3000
```

## Environment variables needed
```
DATABASE_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
```
