"use client";

import { useState, useTransition } from "react";
import { triggerWeeklySync, triggerMonthlySync } from "@/lib/actions/automationActions";

export function WorkflowTriggerButton({ kind }: { kind: "weekly" | "monthly" }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function handleClick() {
    setMessage(null);
    startTransition(async () => {
      const result = kind === "weekly" ? await triggerWeeklySync() : await triggerMonthlySync();
      setMessage(result.ok ? { ok: true, text: "Triggered — refresh in a minute to see it show up as queued." } : { ok: false, text: result.message });
    });
  }

  return (
    <div>
      <button className="action-btn action-btn-done" disabled={isPending} onClick={handleClick}>
        {isPending ? "Triggering…" : "Run now"}
      </button>
      {message && (
        <p style={{ fontSize: "var(--text-sm)", marginTop: "var(--space-2)", color: message.ok ? "var(--color-success)" : "var(--color-critical)" }}>
          {message.text}
        </p>
      )}
    </div>
  );
}
