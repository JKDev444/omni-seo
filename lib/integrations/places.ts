/**
 * Google Business Profile "public data pull" (Step 5). GBP has no public
 * scraping-safe endpoint, so this uses the Places API (New) Place Details
 * endpoint with a plain API key — separate from the GSC/GA4 OAuth flow
 * (step 3), and separate from GBP *manager* access, which this project
 * intentionally does not require per the methodology ("pulled from the
 * public listing if no manager access is provided").
 *
 * Requires GOOGLE_PLACES_API_KEY (Google Cloud project, Places API (New)
 * enabled) and the site's gbpPlaceId. Never throws on missing config —
 * returns a typed data-gap result instead, per the audit methodology's
 * rule to name gaps rather than paper over them.
 */

export interface GbpPublicData {
  placeId: string;
  name?: string;
  primaryCategory?: string;
  categories: string[];
  address?: string;
  phone?: string;
  hours?: string[];
  rating?: number;
  reviewCount?: number;
  photoCount?: number;
  raw: unknown;
}

export type GbpPullResult =
  | { ok: true; data: GbpPublicData }
  | { ok: false; reason: "missing_api_key" | "missing_place_id" | "api_error"; message: string };

const FIELD_MASK = [
  "id",
  "displayName",
  "primaryTypeDisplayName",
  "types",
  "formattedAddress",
  "internationalPhoneNumber",
  "regularOpeningHours",
  "rating",
  "userRatingCount",
  "photos",
].join(",");

export async function fetchGbpPublicData(placeId: string | null | undefined): Promise<GbpPullResult> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: "missing_api_key", message: "GOOGLE_PLACES_API_KEY is not set." };
  }
  if (!placeId) {
    return { ok: false, reason: "missing_place_id", message: "Site has no gbpPlaceId configured." };
  }

  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
    });

    if (!res.ok) {
      const body = await res.text();
      return { ok: false, reason: "api_error", message: `Places API returned ${res.status}: ${body.slice(0, 300)}` };
    }

    const json = await res.json();

    const data: GbpPublicData = {
      placeId,
      name: json.displayName?.text,
      primaryCategory: json.primaryTypeDisplayName?.text,
      categories: Array.isArray(json.types) ? json.types : [],
      address: json.formattedAddress,
      phone: json.internationalPhoneNumber,
      hours: json.regularOpeningHours?.weekdayDescriptions,
      rating: typeof json.rating === "number" ? json.rating : undefined,
      reviewCount: typeof json.userRatingCount === "number" ? json.userRatingCount : undefined,
      photoCount: Array.isArray(json.photos) ? json.photos.length : undefined,
      raw: json,
    };

    return { ok: true, data };
  } catch (err) {
    return { ok: false, reason: "api_error", message: err instanceof Error ? err.message : String(err) };
  }
}
