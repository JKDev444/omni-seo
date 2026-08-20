import * as cheerio from "cheerio";
import type { RawFinding } from "./onPageChecks";
import type { ContentReviewScores } from "../integrations/anthropicContentReview";

export function extractVisibleText(rawHtml: string): string {
  const $ = cheerio.load(rawHtml);
  $("script, style, nav, footer, header").remove();
  return $("body").text().replace(/\s+/g, " ").trim();
}

const DIMENSION_LABELS: Record<keyof ContentReviewScores, string> = {
  headingIntent: "Heading/intent match",
  introQuality: "Intro quality",
  entityCoverage: "Entity coverage",
  trustSignals: "Trust signals",
  freshness: "Content freshness",
  ctaConsistency: "CTA consistency",
};

// Below this, a real finding. LLM judgment, so confidence is
// deliberately lower than the deterministic checks elsewhere.
const SCORE_THRESHOLD = 70;

export function runContentDepthChecks(scores: ContentReviewScores): RawFinding[] {
  const findings: RawFinding[] = [];

  for (const key of Object.keys(DIMENSION_LABELS) as (keyof ContentReviewScores)[]) {
    const { score, issue } = scores[key];
    if (score < SCORE_THRESHOLD && issue) {
      findings.push({
        category: "content",
        checkStep: "Content Depth - LLM Review",
        title: `${DIMENSION_LABELS[key]} below threshold`,
        description: issue,
        priority: score < 40 ? "HIGH" : "MEDIUM",
        confidence: 65,
        fixLocation: "Content rewrite",
      });
    }
  }

  return findings;
}
