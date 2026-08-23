"use client";

import { useState, useTransition } from "react";
import { runPreDeployCheck } from "@/lib/actions/preDeployActions";
import type { PreDeployResult } from "@/lib/checks/preDeployCheck";

function pathFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname === "/" ? "/" : u.pathname;
  } catch {
    return url;
  }
}

const PRIORITY_BADGE: Record<string, string> = { CRITICAL: "tier-critical", HIGH: "tier-high", MEDIUM: "tier-medium", LOW: "tier-low" };

export function DeployCheckForm() {
  const [input, setInput] = useState("");
  const [results, setResults] = useState<PreDeployResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCheck() {
    setError(null);
    startTransition(async () => {
      const result = await runPreDeployCheck(input);
      if ("error" in result) {
        setError(result.error);
        setResults(null);
      } else {
        setResults(result);
      }
    });
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: "var(--space-4)" }}>
        <h2 className="card-title">Check preview URLs before publishing</h2>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--color-ink-muted)", marginBottom: "var(--space-3)" }}>
          Paste one or more Shopify theme preview URLs (Admin → Online Store → Themes → Preview, or any{" "}
          <code>?preview_theme_id=</code> link) — one per line, up to 20. Each is checked the same way a real crawl
          checks a live page, then compared against the current production page at the same path.
        </p>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={"https://your-store.myshopify.com/pages/example?preview_theme_id=123456789"}
          rows={5}
          style={{
            width: "100%",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-sm)",
            padding: "var(--space-3)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            background: "var(--color-canvas)",
            color: "var(--color-ink)",
            marginBottom: "var(--space-3)",
          }}
        />
        <button className="action-btn action-btn-done" onClick={handleCheck} disabled={isPending || !input.trim()}>
          {isPending ? "Checking…" : "Run check"}
        </button>
        {error && <p style={{ color: "var(--color-critical)", fontSize: "var(--text-sm)", marginTop: "var(--space-2)" }}>{error}</p>}
      </div>

      {results && (
        <div>
          {results.map((r, i) => (
            <div className="card" key={i} style={{ marginBottom: "var(--space-3)" }}>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--color-ink-faint)", marginBottom: "var(--space-2)" }}>
                {r.previewUrl}
              </p>

              {r.fetchError ? (
                <p style={{ color: "var(--color-critical)", fontSize: "var(--text-sm)" }}>{r.fetchError}</p>
              ) : (
                <>
                  {r.matchedProductionUrl ? (
                    <p style={{ fontSize: "var(--text-sm)", marginBottom: "var(--space-2)" }}>
                      Matches production page <strong>{pathFromUrl(r.matchedProductionUrl)}</strong>
                    </p>
                  ) : (
                    <p style={{ fontSize: "var(--text-sm)", color: "var(--color-ink-muted)", marginBottom: "var(--space-2)" }}>
                      No matching production page yet — treating this as a new page.
                    </p>
                  )}

                  {r.regressions.length > 0 && (
                    <div style={{ marginBottom: "var(--space-3)" }}>
                      <p style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-critical)", marginBottom: "var(--space-1)" }}>
                        {r.regressions.length} regression{r.regressions.length > 1 ? "s" : ""} vs. production:
                      </p>
                      <ul style={{ margin: 0, paddingLeft: "var(--space-5)", fontSize: "var(--text-sm)" }}>
                        {r.regressions.map((reg, j) => (
                          <li key={j}>{reg}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {r.findings.length > 0 ? (
                    <div>
                      <p style={{ fontSize: "var(--text-sm)", fontWeight: 600, marginBottom: "var(--space-1)" }}>
                        {r.findings.length} finding{r.findings.length > 1 ? "s" : ""} on this preview:
                      </p>
                      <div className="findings-card-list">
                        {r.findings.map((f, j) => (
                          <div key={j} className="finding-card" style={{ borderLeftColor: "var(--color-border-strong)" }}>
                            <span className={`tier-badge ${PRIORITY_BADGE[f.priority] ?? "tier-low"}`}>{f.priority}</span>
                            <div className="finding-card-body">
                              <p className="finding-card-title">{f.title}</p>
                              <p className="finding-card-desc">{f.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    r.regressions.length === 0 && <p style={{ fontSize: "var(--text-sm)", color: "var(--color-success)" }}>No issues found.</p>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
