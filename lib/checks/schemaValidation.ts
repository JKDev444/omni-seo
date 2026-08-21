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

export interface SchemaGap {
  type: string;
  missing: string[];
}

/** Extracts, per schema type present on the page, which required properties are missing (or []). Shared by the per-page and sitewide-aggregate checks below so both work from one parse. */
export function detectSchemaGaps(rawHtml: string): SchemaGap[] {
  const gaps: SchemaGap[] = [];
  const blocks = parseSchemaBlocks(rawHtml);

  for (const block of blocks) {
    for (const type of block.types) {
      const required = REQUIRED_PROPERTIES[type];
      if (!required) continue;

      const missing = required.filter((prop) => {
        const value = block.data[prop];
        return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
      });

      if (missing.length > 0) gaps.push({ type, missing });
    }
  }

  return gaps;
}

/** Per-page: flags schema blocks missing properties Google treats as required/strongly recommended for that type. */
export function runSchemaRequiredPropertiesCheck(rawHtml: string): RawFinding[] {
  return detectSchemaGaps(rawHtml).map(({ type, missing }) => {
    // FAQPage is explicitly de-emphasized per the confirmed May/June/
    // August 2026 rich-result deprecation — still worth flagging as a
    // content-quality/LLM-extractability signal, just not at the same
    // priority as an entity Google actually renders in search.
    const required = REQUIRED_PROPERTIES[type];
    const priority = type === "FAQPage" ? "LOW" : missing.length === required.length ? "HIGH" : "MEDIUM";
    return {
      category: "schema",
      checkStep: "Schema Validation - Required Properties",
      title: `${type} schema missing required propert${missing.length > 1 ? "ies" : "y"}`,
      description: `Missing: ${missing.join(", ")}. Google's structured data guidelines treat these as required for ${type} to be eligible for rich results.`,
      fixType: `Add the missing propert${missing.length > 1 ? "ies" : "y"} (${missing.join(", ")}) to the ${type} JSON-LD block.`,
      priority,
      fixLocation: "Theme Liquid",
    };
  });
}

const SYSTEMIC_GAP_THRESHOLD = 3;

/**
 * Sitewide: when the same schema type is missing the same property across
 * many pages, that's near-certainly one shared Liquid template, not N
 * separate content gaps — confirmed on this site: 84 Article pages were
 * all missing "image", and every one of their og:image tags pointed at
 * the exact same generic site logo, proving the template never sets a
 * per-article image at all. One consolidated finding pointing at the
 * shared template is far more actionable than 84 near-duplicate ones.
 */
export function runSystemicSchemaGapCheck(pages: { url: string; gaps: SchemaGap[] }[]): RawFinding[] {
  const byKey = new Map<string, { type: string; missing: string[]; urls: string[] }>();

  for (const { url, gaps } of pages) {
    for (const gap of gaps) {
      const key = `${gap.type}:${gap.missing.slice().sort().join(",")}`;
      const entry = byKey.get(key) ?? { type: gap.type, missing: gap.missing, urls: [] };
      entry.urls.push(url);
      byKey.set(key, entry);
    }
  }

  const findings: RawFinding[] = [];
  for (const { type, missing, urls } of byKey.values()) {
    if (urls.length < SYSTEMIC_GAP_THRESHOLD) continue;
    findings.push({
      category: "schema",
      checkStep: "Schema Validation - Systemic Gap",
      title: `${type} schema missing "${missing.join('", "')}" on ${urls.length} pages — shared template, not individual content gaps`,
      description: `${urls.length} pages share the exact same ${type} schema gap (${missing.join(", ")}). This is almost certainly one shared Liquid template rather than ${urls.length} separate content edits — fixing the template fixes all ${urls.length} pages at once. Example pages: ${urls.slice(0, 5).join(", ")}${urls.length > 5 ? `, and ${urls.length - 5} more` : ""}.`,
      fixType: `Find the shared ${type} JSON-LD Liquid snippet (likely one file, given it's identical across all ${urls.length} pages) and add the missing propert${missing.length > 1 ? "ies" : "y"}. If a per-page value isn't available (e.g. no per-article featured image), fall back to a sensible default rather than omitting it.`,
      priority: "CRITICAL",
      fixLocation: "Theme Liquid",
    });
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
