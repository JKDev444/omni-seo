import { prisma } from "@/lib/db";
import { getActiveSite } from "@/lib/data/activeSite";

export interface ChangeLogEntry {
  id: string;
  pageUrl: string | null;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  detectedAt: Date;
}

export interface ChangeLogData {
  site: { id: string } | null;
  entries: ChangeLogEntry[];
  totalCount: number;
}

const DEFAULT_LIMIT = 300;

export async function getChangeLogData(limit = DEFAULT_LIMIT): Promise<ChangeLogData> {
  const site = await getActiveSite();
  if (!site) return { site: null, entries: [], totalCount: 0 };

  const [rows, totalCount] = await Promise.all([
    prisma.seoChangeLog.findMany({
      where: { siteId: site.id },
      include: { page: { select: { url: true } } },
      orderBy: { detectedAt: "desc" },
      take: limit,
    }),
    prisma.seoChangeLog.count({ where: { siteId: site.id } }),
  ]);

  return {
    site: { id: site.id },
    entries: rows.map((r) => ({
      id: r.id,
      pageUrl: r.page?.url ?? null,
      field: r.field,
      oldValue: r.oldValue,
      newValue: r.newValue,
      detectedAt: r.detectedAt,
    })),
    totalCount,
  };
}
