import { prisma } from "@/lib/db";
import { fetchCruxData, type FormFactor } from "./crux";
import { fetchPageSpeedInsights } from "./pagespeed";
import { runCoreWebVitalsChecks } from "@/lib/checks/coreWebVitalsChecks";
import { createFindingRecord } from "@/lib/findings/createFinding";

const FORM_FACTORS: FormFactor[] = ["PHONE", "DESKTOP"];

/**
 * CrUX for every crawled page (cheap, fast, real field data — the metric
 * that matters). PSI Lighthouse lab runs only for the homepage — each
 * run takes several seconds server-side, so running it against every
 * page in a site isn't practical, and CrUX is the priority signal anyway.
 */
export async function pullCoreWebVitals(siteId: string): Promise<{ ok: boolean; pulled: number; noData: number; errors: number; findingsCreated: number; message?: string }> {
  const pages = await prisma.page.findMany({ where: { siteId }, select: { id: true, url: true, pageType: true } });
  if (pages.length === 0) return { ok: true, pulled: 0, noData: 0, errors: 0, findingsCreated: 0 };

  // Findings need a crawlId — attach CWV findings to the most recent
  // completed crawl, same as any other periodic (non-crawl-time) check.
  const latestCrawl = await prisma.crawl.findFirst({ where: { siteId, status: "completed" }, orderBy: { startedAt: "desc" } });

  let pulled = 0;
  let noData = 0;
  let errors = 0;
  let findingsCreated = 0;

  for (const { id: pageId, url, pageType } of pages) {
    for (const formFactor of FORM_FACTORS) {
      const result = await fetchCruxData(url, formFactor);

      if (!result.ok) {
        if (result.reason === "missing_api_key") return { ok: false, pulled, noData, errors, findingsCreated, message: result.message };
        if (result.reason === "no_data") noData++;
        else errors++;
        continue;
      }

      const m = result.metrics;
      await prisma.coreWebVitals.upsert({
        where: { siteId_url_formFactor_source: { siteId, url, formFactor, source: "CRUX_FIELD" } },
        update: {
          lcpMs: m.lcpMs,
          inpMs: m.inpMs,
          cls: m.cls,
          lcpRating: m.lcpRating,
          inpRating: m.inpRating,
          clsRating: m.clsRating,
          isOriginFallback: m.isOriginFallback,
          fetchedAt: new Date(),
        },
        create: {
          siteId,
          url,
          formFactor,
          source: "CRUX_FIELD",
          lcpMs: m.lcpMs,
          inpMs: m.inpMs,
          cls: m.cls,
          lcpRating: m.lcpRating,
          inpRating: m.inpRating,
          clsRating: m.clsRating,
          isOriginFallback: m.isOriginFallback,
        },
      });
      pulled++;

      if (latestCrawl) {
        const findings = runCoreWebVitalsChecks({
          url,
          formFactor,
          lcpMs: m.lcpMs,
          lcpRating: m.lcpRating,
          inpMs: m.inpMs,
          inpRating: m.inpRating,
          cls: m.cls,
          clsRating: m.clsRating,
          isOriginFallback: m.isOriginFallback,
        });
        for (const f of findings) {
          await createFindingRecord(latestCrawl.id, pageId, f);
          findingsCreated++;
        }
      }

      await new Promise((r) => setTimeout(r, 100));
    }

    if (pageType === "HOMEPAGE") {
      const psi = await fetchPageSpeedInsights(url, "mobile");
      if (psi.ok) {
        // Plain array/object literal, not a class instance — Prisma's Json
        // input type wants InputJsonValue, which a typed interface array
        // doesn't structurally satisfy without this round-trip.
        const opportunities = JSON.parse(JSON.stringify(psi.data.opportunities));
        await prisma.coreWebVitals.upsert({
          where: { siteId_url_formFactor_source: { siteId, url, formFactor: "PHONE", source: "PSI_LAB" } },
          update: {
            performanceScore: psi.data.performanceScore,
            topOpportunities: opportunities,
            fetchedAt: new Date(),
          },
          create: {
            siteId,
            url,
            formFactor: "PHONE",
            source: "PSI_LAB",
            performanceScore: psi.data.performanceScore,
            topOpportunities: opportunities,
          },
        });
      }
    }
  }

  return { ok: true, pulled, noData, errors, findingsCreated };
}
