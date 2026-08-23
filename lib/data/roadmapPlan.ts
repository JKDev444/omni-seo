/**
 * The two pieces of Phase P that weren't built yet: turning the flat
 * priority list into an actual 30/60/90-day plan, and giving exact
 * platform-specific fix instructions beyond the one-line fixType text.
 *
 * Both are derived, not stored -- checkStep and fixLocation are already
 * on every Finding, so a lookup here stays accurate across re-crawls
 * without needing new columns or touching every check file.
 */
import type { FindingWithPage } from "@/lib/findings/getOpenFindings";
import { PRIORITY_WEIGHT } from "@/lib/data/dashboard";

export type EffortTier = "quick" | "medium" | "long";

// How much work a finding in this checkStep typically takes to actually
// fix, independent of priority -- a CRITICAL noindex tag is a 30-second
// fix; a MEDIUM "content freshness" finding means rewriting a page.
// Unlisted checkSteps default to "medium" (see estimateEffort).
const CHECKSTEP_EFFORT: Record<string, EffortTier> = {
  "Step 1 - Raw HTML": "quick",
  "Step 2 - Indexability": "quick",
  "Step 5 - Local SEO": "quick",
  "Technical SEO Engine - Redirects": "quick",
  "Technical SEO Engine - Indexability": "quick",
  "Technical SEO Engine - Duplicate Content": "medium",
  "Technical SEO Engine - Content Depth": "long",
  "Technical SEO Engine - URL Consistency": "medium",
  "Schema Validation - Required Properties": "medium",
  "Schema Validation - Systemic Gap": "medium",
  "Schema Validation - Entity Consistency": "quick",
  "Schema Validation - URL Consistency": "quick",
  "Schema Validation - Content Match": "quick",
  "Step 4 - Schema by page type": "medium",
  "Internal Link Graph": "quick",
  "Content Depth - LLM Review": "long",
  "AI Search Readiness": "long",
  "Core Web Vitals - Field Data": "long",
  "Regression Detection": "medium",
  "Rich Results Eligibility": "medium",
  "Rendered DOM Comparison": "medium",
};

export function estimateEffort(checkStep: string): EffortTier {
  return CHECKSTEP_EFFORT[checkStep] ?? "medium";
}

// Relative time-cost between tiers -- not measured minutes, just the
// rough multiplier a "medium" or "long" fix costs over a "quick" one,
// used only to rank within a bucket.
const EFFORT_WEIGHT: Record<EffortTier, number> = { quick: 1, medium: 2, long: 4 };

/**
 * ICE (Impact x Confidence / Effort) is the prioritization framework
 * most SEO agencies and tools actually use -- explicitly recommended
 * for solo operators/small teams specifically because it needs no
 * special tooling, just the three inputs every Finding already has:
 * Impact (the same priority-tier weighting the health score already
 * uses, so this doesn't invent a second scale), Confidence (the
 * Finding's own confidence field -- a 60%-confidence heuristic
 * shouldn't outrank a 100%-confidence deterministic check of the same
 * priority), and Effort (estimateEffort above). Used to order findings
 * within a day-bucket, not to decide which bucket they land in --
 * that's still priority + effort together (see computeRoadmapPlan).
 */
export function computeIceScore(f: FindingWithPage): number {
  const impact = PRIORITY_WEIGHT[f.priority];
  const confidence = f.confidence / 100;
  const effort = EFFORT_WEIGHT[estimateEffort(f.checkStep)];
  return (impact * confidence) / effort;
}

export interface FixGuide {
  where: string;
  steps: string[];
}

// Keyed by Finding.fixLocation -- the small, real vocabulary the checks
// actually produce (confirmed against live data, not the larger
// aspirational list from early planning: DNS and Third-party app exist
// in code for redirect/robots checks but haven't fired yet on this site).
export const FIX_LOCATION_GUIDE: Record<string, FixGuide> = {
  "Theme Liquid": {
    where: "Shopify Admin → Online Store → Themes → your live theme → Edit code",
    steps: [
      "Find the template or section file tied to this page's type (templates/page.*.liquid for Shopify pages, a blog-article section for posts, or a dedicated schema/JSON-LD snippet if your theme separates that out).",
      'For schema/JSON-LD findings: search the file for <script type="application/ld+json"> and edit the object described above.',
      "For tag findings (title, meta description, H1, canonical, Open Graph): check theme.liquid's <head> and the page-type template for where that tag is generated.",
      "Preview in the theme editor before publishing live.",
    ],
  },
  "Content rewrite": {
    where: "Shopify Admin → Online Store → Pages (or Blog posts for articles)",
    steps: ["Open the specific page or article named in this finding.", "Edit the body content per the fix described above.", "Save — goes live immediately, no theme publish needed."],
  },
  "Shopify Admin > Page": {
    where: "Shopify Admin → Online Store → Pages → [this page] → Edit",
    steps: ['Scroll to "Search engine listing" at the bottom of the page editor and click Edit website SEO.', "Update the Page title / Meta description / URL handle per the fix.", "Save."],
  },
  "Shopify Admin > Redirects": {
    where: "Shopify Admin → Online Store → Navigation → URL Redirects",
    steps: ['Click "Create URL redirect."', "Enter the old/broken path and the correct destination URL from the finding.", "Save — takes effect immediately."],
  },
  DNS: {
    where: "Your domain registrar or DNS host's control panel (not Shopify)",
    steps: ["Find the record type referenced in the finding.", "Update it per the fix description.", "DNS changes can take up to 24–48 hours to fully propagate."],
  },
  "Third-party app": {
    where: "Shopify Admin → Apps",
    steps: [
      "Identify which installed app controls this element (the finding's description usually names it).",
      "Fix it in that app's own settings — a theme code edit won't stick if an app re-injects this on every page load.",
    ],
  },
};

export interface RoadmapBucket {
  label: string;
  dayRange: string;
  count: number;
  quickWinCount: number;
  topCategories: { checkStep: string; count: number }[];
  /** Findings in this bucket, ordered by ICE score (highest expected value first). */
  orderedFindings: FindingWithPage[];
  /** A realistic "close roughly N/week" framing based on a 4-week bucket -- guidance, not a rule. */
  suggestedPerWeek: number;
}

export interface RoadmapPlan {
  day30: RoadmapBucket;
  day60: RoadmapBucket;
  day90: RoadmapBucket;
}

function topCategoriesFor(findings: FindingWithPage[]): { checkStep: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const f of findings) counts.set(f.checkStep, (counts.get(f.checkStep) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([checkStep, count]) => ({ checkStep, count }));
}

function buildBucket(label: string, dayRange: string, findings: FindingWithPage[]): RoadmapBucket {
  const orderedFindings = [...findings].sort((a, b) => computeIceScore(b) - computeIceScore(a));

  return {
    label,
    dayRange,
    count: findings.length,
    quickWinCount: findings.filter((f) => estimateEffort(f.checkStep) === "quick").length,
    topCategories: topCategoriesFor(findings),
    orderedFindings,
    suggestedPerWeek: findings.length === 0 ? 0 : Math.max(1, Math.ceil(findings.length / 4)),
  };
}

/**
 * Buckets by priority + effort, not priority alone -- a CRITICAL issue
 * always lands in the first 30 days regardless of effort (it's on fire),
 * but a MEDIUM issue that's actually a quick mechanical fix shouldn't
 * wait behind slower HIGH-priority content work just because of its
 * priority label.
 */
export function computeRoadmapPlan(openFindings: FindingWithPage[]): RoadmapPlan {
  const day30: FindingWithPage[] = [];
  const day60: FindingWithPage[] = [];
  const day90: FindingWithPage[] = [];

  for (const f of openFindings) {
    const effort = estimateEffort(f.checkStep);
    if (f.priority === "CRITICAL" || (f.priority === "HIGH" && effort !== "long")) {
      day30.push(f);
    } else if ((f.priority === "HIGH" && effort === "long") || (f.priority === "MEDIUM" && effort !== "long")) {
      day60.push(f);
    } else {
      day90.push(f);
    }
  }

  return {
    day30: buildBucket("Days 1–30: Fix what's urgent and what's fast", "1–30", day30),
    day60: buildBucket("Days 31–60: Clear the remaining priority work", "31–60", day60),
    day90: buildBucket("Days 61–90: Longer content and authority work", "61–90", day90),
  };
}
