/**
 * Complement to getOpenFindings.ts's cross-crawl visibility fix: when a
 * check re-runs against a page and no longer detects an issue it
 * previously found there, that old finding should be marked resolved --
 * not left open forever with no newer row to supersede it.
 *
 * Real bug this fixes: discovered live during an accuracy audit --
 * "Missing canonical tag" on /pages/laser-hair-removal was still shown
 * as an open PENDING finding from the very first crawl (Aug 19), even
 * though the canonical tag genuinely existed on every crawl since
 * (confirmed directly against the live page and against a newer
 * PageSnapshot's stored canonical value). The check that would have
 * caught this simply never creates a "not missing anymore" signal when
 * an issue is gone -- it only creates a new finding when an issue is
 * still present.
 *
 * Reconciliation is scoped per (pageId, checkStep) pair, not just per
 * checkStep -- some checks only run conditionally for a given page in a
 * given crawl (e.g. Rendered DOM Comparison only runs when a renderer
 * actually produced output for that page). Reconciling a checkStep
 * against a page it wasn't actually re-run against this pass would
 * incorrectly resolve a finding nobody re-checked. Callers must record
 * exactly which (pageId, checkStep) pairs were actually evaluated.
 */
import { prisma } from "@/lib/db";

export interface FindingKey {
  pageId: string | null;
  category: string;
  checkStep: string;
  title: string;
}

function issueKey(k: FindingKey): string {
  return `${k.pageId ?? "sitewide"}::${k.category}::${k.checkStep}::${k.title}`;
}

function pairKey(pageId: string | null, checkStep: string): string {
  return `${pageId ?? "sitewide"}::${checkStep}`;
}

/** Tracks which (pageId, checkStep) pairs were actually re-evaluated during a crawl. */
export class ReconciliationTracker {
  private reEvaluated = new Set<string>();
  private created: FindingKey[] = [];

  /** Call once for every check invocation against a page (or null for sitewide), regardless of whether it found anything. */
  markEvaluated(pageId: string | null, checkStep: string) {
    this.reEvaluated.add(pairKey(pageId, checkStep));
  }

  /** Call for every finding actually created this crawl, so it isn't immediately un-resolved by the reconciliation pass. */
  markCreated(key: FindingKey) {
    this.created.push(key);
  }

  async resolveFixedFindings(siteId: string): Promise<number> {
    if (this.reEvaluated.size === 0) return 0;

    const priorOpen = await prisma.finding.findMany({
      where: { crawl: { siteId }, status: "PENDING" },
      select: { id: true, pageId: true, category: true, checkStep: true, title: true },
    });

    const createdKeys = new Set(this.created.map(issueKey));

    const toResolve = priorOpen.filter((f) => {
      if (!this.reEvaluated.has(pairKey(f.pageId, f.checkStep))) return false;
      return !createdKeys.has(issueKey(f));
    });

    if (toResolve.length === 0) return 0;

    await prisma.finding.updateMany({
      where: { id: { in: toResolve.map((f) => f.id) } },
      data: { status: "VERIFIED" },
    });

    return toResolve.length;
  }
}
