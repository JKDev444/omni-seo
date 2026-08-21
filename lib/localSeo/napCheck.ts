/**
 * Step 5 (Local SEO) — NAP consistency check across footer, schema, and the
 * public GBP listing. Per Exact_Audit_Methodology.md: "NAP consistency
 * across site, GBP, footer, schema, and any citations." Per the tier table,
 * NAP inconsistency is a ranking-affecting issue, not a crawl-blocking one
 * — it's classified HIGH, not CRITICAL.
 *
 * This only flags disagreements between sources; it never decides which
 * source is correct — that's a human call (per the methodology's Step 0.5
 * false-positive protocol).
 */
import type { RawFinding } from "@/lib/checks/onPageChecks";
import type { NapSnapshot } from "@/lib/localSeo/extract";

export interface NapSource {
  label: "footer" | "schema" | "GBP public listing";
  nap: NapSnapshot | null;
}

function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : null;
}

const STATE_NAME_TO_ABBR: Record<string, string> = {
  alabama: "al", alaska: "ak", arizona: "az", arkansas: "ar", california: "ca",
  colorado: "co", connecticut: "ct", delaware: "de", florida: "fl", georgia: "ga",
  hawaii: "hi", idaho: "id", illinois: "il", indiana: "in", iowa: "ia",
  kansas: "ks", kentucky: "ky", louisiana: "la", maine: "me", maryland: "md",
  massachusetts: "ma", michigan: "mi", minnesota: "mn", mississippi: "ms", missouri: "mo",
  montana: "mt", nebraska: "ne", nevada: "nv", "new hampshire": "nh", "new jersey": "nj",
  "new mexico": "nm", "new york": "ny", "north carolina": "nc", "north dakota": "nd", ohio: "oh",
  oklahoma: "ok", oregon: "or", pennsylvania: "pa", "rhode island": "ri", "south carolina": "sc",
  "south dakota": "sd", tennessee: "tn", texas: "tx", utah: "ut", vermont: "vt",
  virginia: "va", washington: "wa", "west virginia": "wv", wisconsin: "wi", wyoming: "wy",
};

function normalizeAddress(address: string | null): string | null {
  if (!address) return null;
  let normalized = address
    .toLowerCase()
    .replace(/[.,#]/g, "")
    .replace(/\bsuite\b/g, "ste")
    .replace(/\bstreet\b/g, "st")
    .replace(/\savenue\b/g, "ave")
    .replace(/\s+/g, " ")
    .trim();
  for (const [name, abbr] of Object.entries(STATE_NAME_TO_ABBR)) {
    normalized = normalized.replace(new RegExp(`\\b${name}\\b`, "g"), abbr);
  }
  // The Places API's formattedAddress includes a trailing country name
  // ("... 98501, USA") that footer/schema addresses never carry — without
  // stripping it, every real GBP cross-check flags a false mismatch.
  normalized = normalized.replace(/\s+(usa|united states( of america)?)\s*$/, "").trim();
  return normalized;
}

export function runNapConsistencyCheck(sources: NapSource[]): RawFinding[] {
  const findings: RawFinding[] = [];
  const present = sources.filter((s) => s.nap !== null);

  for (const s of sources) {
    if (s.nap === null) {
      findings.push({
        category: "local",
        checkStep: "Step 5 - Local SEO",
        title: `NAP source unavailable: ${s.label}`,
        description: `No NAP data could be found for the ${s.label} source, so it could not be cross-checked for consistency.`,
        priority: "LOW",
      });
    }
  }

  for (let i = 0; i < present.length; i++) {
    for (let j = i + 1; j < present.length; j++) {
      const a = present[i];
      const b = present[j];
      const phoneA = normalizePhone(a.nap!.phone);
      const phoneB = normalizePhone(b.nap!.phone);
      const addrA = normalizeAddress(a.nap!.addressText);
      const addrB = normalizeAddress(b.nap!.addressText);

      if (phoneA && phoneB && phoneA !== phoneB) {
        findings.push({
          category: "local",
          checkStep: "Step 5 - Local SEO",
          title: `Phone mismatch: ${a.label} vs. ${b.label}`,
          description: `${a.label} shows "${a.nap!.phone}"; ${b.label} shows "${b.nap!.phone}". Inconsistent NAP hurts local pack ranking and confuses customers.`,
          fixType: "Confirm the correct phone number and update whichever source is wrong.",
          howToTest: "Re-crawl and re-check the public GBP listing; confirm both sources match.",
          priority: "HIGH",
          owner: "local seo manager",
        });
      }

      if (addrA && addrB && addrA !== addrB) {
        findings.push({
          category: "local",
          checkStep: "Step 5 - Local SEO",
          title: `Address mismatch: ${a.label} vs. ${b.label}`,
          description: `${a.label} shows "${a.nap!.addressText}"; ${b.label} shows "${b.nap!.addressText}". Inconsistent NAP hurts local pack ranking and confuses customers.`,
          fixType: "Confirm the correct address (especially suite/unit number) and update whichever source is wrong.",
          howToTest: "Re-crawl and re-check the public GBP listing; confirm both sources match.",
          priority: "HIGH",
          owner: "local seo manager",
        });
      }
    }
  }

  return findings;
}
