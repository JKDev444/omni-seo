/**
 * Shared service-account auth for GSC + GA4. Deliberately not OAuth —
 * per the auth.ts rewrite, site login has nothing to do with Google, and
 * a service account means pulling this data never depends on a human
 * being signed in. Setup is a few clicks each, not a consent-screen flow:
 * create the service account in Google Cloud, then add its email as a
 * user on the Search Console property and the GA4 property directly.
 *
 * GOOGLE_SERVICE_ACCOUNT_KEY holds the full JSON key, either raw or
 * base64-encoded (base64 avoids newline-escaping headaches with the
 * private key field in most .env / Vercel env var UIs).
 */
import { GoogleAuth } from "google-auth-library";

export type ServiceAccountResult =
  | { ok: true; auth: GoogleAuth }
  | { ok: false; reason: "missing_credentials" | "invalid_credentials"; message: string };

function parseServiceAccountKey(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw);
  } catch {
    try {
      return JSON.parse(Buffer.from(raw, "base64").toString("utf-8"));
    } catch {
      return null;
    }
  }
}

export function getGoogleServiceAccountAuth(scopes: string[]): ServiceAccountResult {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    return { ok: false, reason: "missing_credentials", message: "GOOGLE_SERVICE_ACCOUNT_KEY is not set." };
  }

  const credentials = parseServiceAccountKey(raw);
  if (!credentials || !credentials.client_email || !credentials.private_key) {
    return {
      ok: false,
      reason: "invalid_credentials",
      message: "GOOGLE_SERVICE_ACCOUNT_KEY isn't valid service-account JSON (checked raw and base64-decoded).",
    };
  }

  const auth = new GoogleAuth({ credentials, scopes });
  return { ok: true, auth };
}
