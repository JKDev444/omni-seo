/**
 * Heuristic extraction of NAP (Name/Address/Phone) signals from raw HTML,
 * for the Step 5 Local SEO NAP consistency check. Two independent sources
 * live on the page itself — the visible footer and the JSON-LD schema —
 * a third (GBP) comes from lib/integrations/places.ts.
 *
 * This is best-effort pattern matching, not a real address parser. It's
 * meant to catch clear mismatches (different suite number, different area
 * code), not to validate address formatting.
 */
import * as cheerio from "cheerio";

export interface NapSnapshot {
  phone: string | null;
  addressText: string | null;
}

const PHONE_RE = /(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/;
// Street number through zip, e.g. "3409 Capitol Blvd SE, Tumwater, Washington 98501".
// Anchored on a leading digit so it doesn't sweep up unrelated preceding text
// (financing widgets, nav labels, etc. commonly sit right next to footer NAP).
const ADDRESS_RE = /\d{1,6}\s+[A-Za-z0-9.,#'\- ]{3,70}?\b\d{5}(-\d{4})?\b/;

export function extractFooterNap(rawHtml: string): NapSnapshot {
  const $ = cheerio.load(rawHtml);
  const footer = $("footer").length ? $("footer") : $("body");
  const text = footer.text().replace(/\s+/g, " ").trim();

  const phoneMatch = text.match(PHONE_RE);
  // Strip the matched phone number before hunting for an address so its
  // trailing digits (e.g. "...338-0289 3409 Capitol Blvd...") can't be
  // mistaken for the start of a street number.
  const textWithoutPhone = phoneMatch ? text.replace(phoneMatch[0], " ") : text;
  const addressMatch = textWithoutPhone.match(ADDRESS_RE);

  return {
    phone: phoneMatch ? phoneMatch[0] : null,
    addressText: addressMatch ? addressMatch[0].trim() : null,
  };
}

export interface LocalBusinessSchema {
  name?: string;
  telephone?: string;
  address?: {
    streetAddress?: string;
    addressLocality?: string;
    addressRegion?: string;
    postalCode?: string;
  };
  raw: Record<string, unknown>;
}

const LOCAL_BUSINESS_TYPES = new Set([
  "LocalBusiness",
  "MedicalBusiness",
  "MedicalClinic",
  "HealthAndBeautyBusiness",
  "DaySpa",
  "Physician",
]);

export function extractLocalBusinessSchema(rawHtml: string): LocalBusinessSchema | null {
  const $ = cheerio.load(rawHtml);
  let found: LocalBusinessSchema | null = null;

  $('script[type="application/ld+json"]').each((_, el) => {
    if (found) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse($(el).text());
    } catch {
      return;
    }
    const candidates = Array.isArray(parsed) ? parsed : [parsed];
    for (const c of candidates) {
      if (!c || typeof c !== "object") continue;
      const obj = c as Record<string, unknown>;
      const type = obj["@type"];
      const types = Array.isArray(type) ? type : [type];
      if (!types.some((t) => typeof t === "string" && LOCAL_BUSINESS_TYPES.has(t))) continue;

      const address = obj.address as Record<string, unknown> | undefined;
      found = {
        name: typeof obj.name === "string" ? obj.name : undefined,
        telephone: typeof obj.telephone === "string" ? obj.telephone : undefined,
        address: address
          ? {
              streetAddress: typeof address.streetAddress === "string" ? address.streetAddress : undefined,
              addressLocality: typeof address.addressLocality === "string" ? address.addressLocality : undefined,
              addressRegion: typeof address.addressRegion === "string" ? address.addressRegion : undefined,
              postalCode: typeof address.postalCode === "string" ? address.postalCode : undefined,
            }
          : undefined,
        raw: obj,
      };
    }
  });

  return found;
}

export function schemaAddressText(schema: LocalBusinessSchema | null): string | null {
  if (!schema?.address) return null;
  const { streetAddress, addressLocality, addressRegion, postalCode } = schema.address;
  return [streetAddress, addressLocality, addressRegion, postalCode].filter(Boolean).join(", ") || null;
}
