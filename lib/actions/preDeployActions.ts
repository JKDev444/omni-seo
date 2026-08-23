"use server";

import { getActiveSite } from "@/lib/data/activeSite";
import { checkPreviewUrl, type PreDeployResult } from "@/lib/checks/preDeployCheck";

export async function runPreDeployCheck(rawUrls: string): Promise<PreDeployResult[] | { error: string }> {
  const site = await getActiveSite();
  if (!site) return { error: "No site is configured yet." };

  const urls = rawUrls
    .split("\n")
    .map((u) => u.trim())
    .filter(Boolean);

  if (urls.length === 0) return { error: "Paste at least one preview URL." };
  if (urls.length > 20) return { error: "Check 20 URLs or fewer at a time." };

  return Promise.all(urls.map((url) => checkPreviewUrl(site.id, url)));
}
