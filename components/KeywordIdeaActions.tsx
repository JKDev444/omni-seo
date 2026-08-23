"use client";

import { useTransition } from "react";
import { trackKeywordIdea, dismissKeywordIdea } from "@/lib/actions/keywordIdeaActions";

export function KeywordIdeaActions({ ideaId }: { ideaId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div style={{ display: "flex", gap: "var(--space-2)" }}>
      <button
        className="action-btn action-btn-done"
        disabled={isPending}
        onClick={() => startTransition(async () => { await trackKeywordIdea(ideaId); })}
      >
        Track
      </button>
      <button
        className="action-btn"
        disabled={isPending}
        onClick={() => startTransition(async () => { await dismissKeywordIdea(ideaId); })}
      >
        Dismiss
      </button>
    </div>
  );
}
