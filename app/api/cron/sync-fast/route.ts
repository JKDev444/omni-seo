/**
 * Vercel Cron: the operations genuinely fast enough (single-digit seconds
 * to low tens of seconds) to fit inside a serverless function's execution
 * limit, on any plan. Everything slower (full crawl, keyword rank checks,
 * Core Web Vitals, content review, backlinks) runs instead via the
 * GitHub Actions workflow at .github/workflows/seo-sync.yml, which has no
 * comparable timeout — see README.md's Automation section for why this
 * split exists (real observed crawl times of 10-25 minutes exceed even
 * Vercel's most generous Fluid Compute limit of 800s).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { pullGscMetrics } from "@/lib/integrations/gsc";
import { pullGa4Metrics } from "@/lib/integrations/ga4";
import { pullGbpProfile } from "@/lib/localSeo/runLocalSeoAudit";

export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const site = await prisma.site.findFirst();
  if (!site) return NextResponse.json({ ok: false, message: "No site configured." });

  const results: Record<string, unknown> = {};

  results.gsc = await pullGscMetrics(site.id);
  results.ga4 = await pullGa4Metrics(site.id);

  // GbpPullResult's data.raw is the full Places API payload (photo
  // metadata, attribution URLs, etc.) -- already persisted by
  // pullGbpProfile, so echoing it back here just bloats the cron log.
  const gbp = await pullGbpProfile(site.id);
  results.gbp = gbp.ok ? { ok: true, name: gbp.data.name, rating: gbp.data.rating, reviewCount: gbp.data.reviewCount } : gbp;

  return NextResponse.json({ ok: true, results });
}
