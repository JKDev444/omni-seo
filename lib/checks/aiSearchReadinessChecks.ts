import type { RawFinding } from "./onPageChecks";
import type { AiSearchReadinessScores } from "@/lib/integrations/anthropicAiSearchReadiness";

const DIMENSION_LABELS: Record<"entityClarity" | "citationReadiness" | "extractability", string> = {
  entityClarity: "Entity clarity for AI search",
  citationReadiness: "AI citation readiness",
  extractability: "Content extractability for AI answers",
};

const SCORE_THRESHOLD = 70;

export function runAiSearchReadinessChecks(scores: AiSearchReadinessScores): RawFinding[] {
  const findings: RawFinding[] = [];

  for (const key of Object.keys(DIMENSION_LABELS) as (keyof typeof DIMENSION_LABELS)[]) {
    const { score, issue } = scores[key];
    if (score < SCORE_THRESHOLD && issue) {
      findings.push({
        category: "content",
        checkStep: "AI Search Readiness",
        title: `${DIMENSION_LABELS[key]} below threshold`,
        description: issue,
        priority: score < 40 ? "MEDIUM" : "LOW",
        confidence: 60,
        fixLocation: "Content rewrite",
      });
    }
  }

  if (!scores.hasAnswerBlock) {
    findings.push({
      category: "content",
      checkStep: "AI Search Readiness",
      title: "No direct answer block for AI search",
      description:
        "This page has no concise 40-80 word direct answer to a \"What is X?\"-style question near the top of the content — the kind of self-contained passage AI Overviews and chat assistants tend to lift for citation.",
      fixType: "Add a short, direct answer to the page's core question near the top (before diving into detail) — a definition or summary an AI system could quote standalone.",
      priority: "LOW",
      confidence: 60,
      fixLocation: "Content rewrite",
    });
  }

  return findings;
}
