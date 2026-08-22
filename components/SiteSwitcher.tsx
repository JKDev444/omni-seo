"use client";

import { useTransition } from "react";
import { setActiveSite } from "@/lib/actions/siteActions";

export function SiteSwitcher({ sites, activeSiteId }: { sites: { id: string; domain: string }[]; activeSiteId: string }) {
  const [isPending, startTransition] = useTransition();

  if (sites.length <= 1) return null;

  return (
    <select
      className="sidebar-site-select"
      defaultValue={activeSiteId}
      disabled={isPending}
      aria-label="Active site"
      onChange={(e) => {
        const siteId = e.target.value;
        startTransition(() => {
          setActiveSite(siteId);
        });
      }}
    >
      {sites.map((s) => (
        <option key={s.id} value={s.id}>
          {s.domain}
        </option>
      ))}
    </select>
  );
}
