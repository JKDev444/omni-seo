/**
 * Compares raw HTML (what a non-JS crawler/search engine sees) against
 * rendered DOM (what actually shows up after JavaScript runs). A mismatch
 * here is itself the finding — this is exactly the bug class that's hit
 * Omni before (a slider library cloning an H1, a chat/review widget
 * injecting markup that changes what the page "says").
 */
import * as cheerio from "cheerio";
import type { RawFinding } from "./onPageChecks";

export function runRenderComparisonChecks(rawHtml: string, renderedHtml: string): RawFinding[] {
  const findings: RawFinding[] = [];
  const $raw = cheerio.load(rawHtml);
  const $rendered = cheerio.load(renderedHtml);

  const rawH1Count = $raw("h1").length;
  const renderedH1Count = $rendered("h1").length;
  if (renderedH1Count !== rawH1Count) {
    findings.push({
      category: "technical",
      checkStep: "Rendered DOM Comparison",
      title: "H1 count differs between raw HTML and rendered DOM",
      description: `Raw HTML has ${rawH1Count} H1(s); rendered DOM has ${renderedH1Count}. A client-side script (slider/carousel library, chat or review widget, theme JS) is likely adding or cloning heading elements after the page loads.`,
      fixType: "Find the script touching H1 elements (check slider libraries cloning slides, and any third-party widgets) and keep H1s server-rendered and untouched.",
      priority: renderedH1Count > rawH1Count ? "MEDIUM" : "HIGH",
      confidence: 90,
      source: "BOTH",
      fixLocation: "Third-party app",
    });
  }

  const rawTitle = $raw("title").first().text().trim();
  const renderedTitle = $rendered("title").first().text().trim();
  if (rawTitle && renderedTitle && rawTitle !== renderedTitle) {
    findings.push({
      category: "technical",
      checkStep: "Rendered DOM Comparison",
      title: "Title tag changes after page load",
      description: `Raw HTML title: "${rawTitle}". Rendered title: "${renderedTitle}". Search engines index the raw version — whatever a script sets client-side isn't what gets crawled.`,
      fixType: "Find the script setting document.title and fix the title server-side instead.",
      priority: "MEDIUM",
      confidence: 85,
      source: "BOTH",
      fixLocation: "Third-party app",
    });
  }

  const rawMetaDesc = $raw('meta[name="description"]').attr("content")?.trim();
  const renderedMetaDesc = $rendered('meta[name="description"]').attr("content")?.trim();
  if (rawMetaDesc && renderedMetaDesc && rawMetaDesc !== renderedMetaDesc) {
    findings.push({
      category: "technical",
      checkStep: "Rendered DOM Comparison",
      title: "Meta description changes after page load",
      description: `Raw HTML: "${rawMetaDesc}". Rendered: "${renderedMetaDesc}". Search engines index the raw version.`,
      priority: "LOW",
      confidence: 80,
      source: "BOTH",
      fixLocation: "Third-party app",
    });
  }

  return findings;
}
