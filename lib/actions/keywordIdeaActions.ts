"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

export async function trackKeywordIdea(ideaId: string): Promise<{ ok: boolean; message?: string }> {
  const idea = await prisma.keywordIdea.findUnique({ where: { id: ideaId } });
  if (!idea) return { ok: false, message: "Idea not found." };
  if (idea.trackedAsKeywordId) return { ok: false, message: "Already tracked." };

  const keyword = await prisma.keyword.upsert({
    where: { siteId_phrase: { siteId: idea.siteId, phrase: idea.phrase } },
    create: {
      siteId: idea.siteId,
      phrase: idea.phrase,
      source: "discovery",
      searchVolume: idea.searchVolume,
      cpc: idea.cpc,
      difficulty: idea.difficulty,
    },
    update: {},
  });

  await prisma.keywordIdea.update({ where: { id: ideaId }, data: { trackedAsKeywordId: keyword.id } });
  revalidatePath("/keywords");
  return { ok: true };
}

export async function dismissKeywordIdea(ideaId: string): Promise<{ ok: boolean }> {
  await prisma.keywordIdea.update({ where: { id: ideaId }, data: { dismissed: true } });
  revalidatePath("/keywords");
  return { ok: true };
}
