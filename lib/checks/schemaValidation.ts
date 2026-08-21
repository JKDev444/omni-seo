/**
 * Phase M (partial): Schema Validation Engine — goes beyond "does schema
 * exist" (already covered in onPageChecks.ts) to check required
 * properties per type and @id consistency for the entity that matters
 * most for local SEO (LocalBusiness/Organization should be the exact same
 * entity — same @id — on every page, not a different one per template).
 *
 * Deliberately scoped to the two highest-value, purely-crawl-data-derived
 * checks. Not built: schema-vs-visible-content mismatch and
 * schema-URL-redirect checks (both need extra fetches per page for
 * marginal value) and full Rich-Results-Test eligibility (a genuinely
 * separate concern from Schema.org validity — would need Google's Rich
 * Results Test API, a new integration, not yet justified).
 */
import * as cheerio from "cheerio";
import type { RawFinding } from "./onPageChecks";

// Required properties per Schema.org type for the rich-result / entity-
// clarity purposes that actually matter here — not the full Schema.org
// spec (most properties there are optional), just what Google's
// structured data guidelines treat as required or strongly recommended.
const REQUIRED_PROPERTIES: Record<string, string[]> = {
  LocalBusiness: ["name", "address", "telephone"],
  MedicalBusiness: ["name", "address", "telephone"],
  Organization: ["name", "url"],
  Article: ["headline", "image", "datePublished", "author"],
  BlogPosting: ["headline", "image", "datePublished", "author"],
  Product: ["name", "image"],
  FAQPage: ["mainEntity"],
  BreadcrumbList: ["itemListElement"],
};

interface ParsedSchemaBlock {
  types: string[];
  data: Record<string, unknown>;
  id: string | null;
}

function parseSchemaBlocks(rawHtml: string): ParsedSchemaBlock[] {
  const $ = cheerio.load(rawHtml);
  const blocks: ParsedSchemaBlock[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).text());
      const entries = Array.isArray(parsed["@graph"]) ? parsed["@graph"] : [parsed];
      for (const entry of entries) {
        const type = entry["@type"];
        if (!type) continue;
        blocks.push({
          types: Array.isArray(type) ? type : [type],
          data: entry,
          id: typeof entry["@id"] === "string" ? entry["@id"] : null,
        });
      }
    } catch {
      // Invalid JSON is already flagged by onPageChecks.ts — not this module's concern.
    }
  });

  return blocks;
}

/** Per-page: flags schema blocks missing properties Google treats as required/strongly recommended for that type. */
export function runSchemaRequiredPropertiesCheck(rawHtml: string): RawFinding[] {
  const findings: RawFinding[] = [];
  const blocks = parseSchemaBlocks(rawHtml);

  for (const block of blocks) {
    for (const type of block.types) {
      const required = REQUIRED_PROPERTIES[type];
      if (!required) continue;

      const missing = required.filter((prop) => {
        const value = block.data[prop];
        return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
      });

      if (missing.length > 0) {
        // FAQPage is explicitly de-emphasized per the confirmed May/June/
        // August 2026 rich-result deprecation — still worth flagging as a
        // content-quality/LLM-extractability signal, just not at the same
        // priority as an entity Google actually renders in search.
        const priority = type === "FAQPage" ? "LOW" : missing.length === required.length ? "HIGH" : "MEDIUM";
        findings.push({
          category: "schema",
          checkStep: "Schema Validation - Required Properties",
          title: `${type} schema missing required propert${missing.length > 1 ? "ies" : "y"}`,
          description: `Missing: ${missing.join(", ")}. Google's structured data guidelines treat these as required for ${type} to be eligible for rich results.`,
          fixType: `Add the missing propert${missing.length > 1 ? "ies" : "y"} (${missing.join(", ")}) to the ${type} JSON-LD block.`,
          priority,
          fixLocation: "Theme Liquid",
        });
      }
    }
  }

  return findings;
}

export interface PageLocalBusinessId {
  url: string;
  id: string | null;
  hasLocalBusinessSchema: boolean;
}

/** Sitewide: extracts each page's LocalBusiness/Organization @id (if present) for cross-page consistency checking. */
export function extractLocalBusinessId(rawHtml: string): PageLocalBusinessId["id"] {
  const blocks = parseSchemaBlocks(rawHtml);
  const entityBlock = blocks.find((b) => b.types.some((t) => t === "LocalBusiness" || t === "MedicalBusiness" || t === "Organization"));
  return entityBlock?.id ?? null;
}

/**
 * Sitewide: LocalBusiness/Organization should be the exact same entity —
 * same @id — across every page that declares it. A different @id per
 * template (common when a theme and an app both inject it, or different
 * templates were built independently) fragments the entity in Google's
 * eyes instead of reinforcing one consistent local business.
 */
export function runLocalBusinessIdConsistencyCheck(pages: PageLocalBusinessId[]): { url: string; finding: RawFinding }[] {
  const withId = pages.filter((p) => p.id !== null);
  if (withId.length < 2) return [];

  const idCounts = new Map<string, number>();
  for (const p of withId) idCounts.set(p.id!, (idCounts.get(p.id!) ?? 0) + 1);
  if (idCounts.size <= 1) return []; // all consistent

  const dominantId = [...idCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const results: { url: string; finding: RawFinding }[] = [];

  for (const p of withId) {
    if (p.id === dominantId) continue;
    results.push({
      url: p.url,
      finding: {
        category: "schema",
        checkStep: "Schema Validation - Entity Consistency",
        title: "LocalBusiness @id inconsistent with the rest of the site",
        description: `This page's LocalBusiness/Organization schema uses @id "${p.id}", but most pages use "${dominantId}" — Google may treat these as different entities instead of one consistent business.`,
        fixType: `Change this page's @id to match the site-wide value: "${dominantId}".`,
        priority: "MEDIUM",
        fixLocation: "Theme Liquid",
      },
    });
  }

  return results;
}
