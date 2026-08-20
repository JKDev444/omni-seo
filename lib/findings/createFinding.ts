import { prisma } from "@/lib/db";
import type { RawFinding } from "@/lib/checks/onPageChecks";

/** Shared by the crawler and any other process that produces findings against a crawl. */
export async function createFindingRecord(crawlId: string, pageId: string | null, f: RawFinding) {
  await prisma.finding.create({
    data: {
      crawlId,
      pageId,
      category: f.category,
      checkStep: f.checkStep,
      title: f.title,
      description: f.description,
      fixType: f.fixType,
      howToTest: f.howToTest,
      priority: f.priority,
      owner: f.owner,
      confidence: f.confidence ?? 100,
      fixLocation: f.fixLocation,
      source: f.source ?? "RAW_HTML",
      status: "PENDING",
    },
  });
}
