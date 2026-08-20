import type { RawFinding } from "./onPageChecks";
import type { Rating } from "../integrations/crux";

interface CwvInput {
  url: string;
  formFactor: string;
  lcpMs: number | null;
  lcpRating: Rating | null;
  inpMs: number | null;
  inpRating: Rating | null;
  cls: number | null;
  clsRating: Rating | null;
  isOriginFallback: boolean;
}

/** Real-user CrUX data only — this is the metric that actually affects ranking, per methodology. */
export function runCoreWebVitalsChecks(cwv: CwvInput): RawFinding[] {
  const findings: RawFinding[] = [];
  const scope = cwv.isOriginFallback ? "sitewide (no page-specific data)" : "this page";

  if (cwv.lcpRating === "poor") {
    findings.push({
      category: "technical",
      checkStep: "Core Web Vitals - Field Data",
      title: `Poor LCP on ${cwv.formFactor.toLowerCase()}`,
      description: `Largest Contentful Paint is ${(cwv.lcpMs! / 1000).toFixed(1)}s at the 75th percentile (real users, ${scope}) — over the 4.0s "poor" threshold. Good is under 2.5s.`,
      fixType: "Optimize the largest above-fold element: compress/resize the hero image, remove render-blocking resources, use a CDN.",
      priority: "HIGH",
      confidence: 100,
      source: "RENDERED_DOM",
      fixLocation: "Theme Liquid",
    });
  } else if (cwv.lcpRating === "needs-improvement") {
    findings.push({
      category: "technical",
      checkStep: "Core Web Vitals - Field Data",
      title: `LCP needs improvement on ${cwv.formFactor.toLowerCase()}`,
      description: `LCP is ${(cwv.lcpMs! / 1000).toFixed(1)}s at the 75th percentile (real users, ${scope}) — between the 2.5s "good" and 4.0s "poor" thresholds.`,
      priority: "MEDIUM",
      confidence: 100,
      source: "RENDERED_DOM",
      fixLocation: "Theme Liquid",
    });
  }

  if (cwv.inpRating === "poor") {
    findings.push({
      category: "technical",
      checkStep: "Core Web Vitals - Field Data",
      title: `Poor INP on ${cwv.formFactor.toLowerCase()}`,
      description: `Interaction to Next Paint is ${Math.round(cwv.inpMs!)}ms at the 75th percentile (real users, ${scope}) — over the 500ms "poor" threshold. Good is under 200ms.`,
      fixType: "Reduce JavaScript execution time on interaction — break up long tasks, defer non-critical scripts, audit third-party widgets.",
      priority: "HIGH",
      confidence: 100,
      source: "RENDERED_DOM",
      fixLocation: "Third-party app",
    });
  } else if (cwv.inpRating === "needs-improvement") {
    findings.push({
      category: "technical",
      checkStep: "Core Web Vitals - Field Data",
      title: `INP needs improvement on ${cwv.formFactor.toLowerCase()}`,
      description: `INP is ${Math.round(cwv.inpMs!)}ms at the 75th percentile (real users, ${scope}).`,
      priority: "MEDIUM",
      confidence: 100,
      source: "RENDERED_DOM",
      fixLocation: "Third-party app",
    });
  }

  if (cwv.clsRating === "poor") {
    findings.push({
      category: "technical",
      checkStep: "Core Web Vitals - Field Data",
      title: `Poor CLS on ${cwv.formFactor.toLowerCase()}`,
      description: `Cumulative Layout Shift is ${cwv.cls!.toFixed(2)} at the 75th percentile (real users, ${scope}) — over the 0.25 "poor" threshold. Good is under 0.1.`,
      fixType: "Set explicit width/height on images and embeds, reserve space for ads/dynamic content, avoid inserting content above existing content.",
      priority: "HIGH",
      confidence: 100,
      source: "RENDERED_DOM",
      fixLocation: "Theme Liquid",
    });
  } else if (cwv.clsRating === "needs-improvement") {
    findings.push({
      category: "technical",
      checkStep: "Core Web Vitals - Field Data",
      title: `CLS needs improvement on ${cwv.formFactor.toLowerCase()}`,
      description: `CLS is ${cwv.cls!.toFixed(2)} at the 75th percentile (real users, ${scope}).`,
      priority: "MEDIUM",
      confidence: 100,
      source: "RENDERED_DOM",
      fixLocation: "Theme Liquid",
    });
  }

  return findings;
}
