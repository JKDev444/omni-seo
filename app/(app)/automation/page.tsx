import { listWorkflowRuns, type WorkflowRun } from "@/lib/integrations/github";
import { WorkflowTriggerButton } from "@/components/WorkflowTriggerButton";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, { background: string; color: string }> = {
  success: { background: "var(--color-success-soft)", color: "var(--color-success)" },
  failure: { background: "var(--color-critical-soft)", color: "var(--color-critical)" },
  cancelled: { background: "var(--color-surface-sunken)", color: "var(--color-ink-faint)" },
  in_progress: { background: "var(--color-warning-soft)", color: "var(--color-warning)" },
  queued: { background: "var(--color-warning-soft)", color: "var(--color-warning)" },
};

function runLabel(run: WorkflowRun): string {
  if (run.status !== "completed") return run.status; // queued | in_progress
  return run.conclusion ?? "unknown";
}

function RunsList({ runs }: { runs: WorkflowRun[] }) {
  if (runs.length === 0) {
    return <p style={{ fontSize: "var(--text-sm)", color: "var(--color-ink-muted)" }}>No runs yet.</p>;
  }
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: "var(--space-3) 0 0" }}>
      {runs.map((run) => {
        const label = runLabel(run);
        return (
          <li key={run.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", padding: "6px 0", fontSize: "var(--text-sm)" }}>
            <span className="tier-badge" style={STATUS_STYLE[label] ?? STATUS_STYLE.queued}>
              {label.replace("_", " ")}
            </span>
            <span style={{ color: "var(--color-ink-muted)" }}>{new Date(run.createdAt).toLocaleString()}</span>
            <a href={run.htmlUrl} target="_blank" rel="noreferrer" style={{ color: "var(--color-accent)", fontSize: "var(--text-xs)" }}>
              View log ↗
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export default async function AutomationPage() {
  const [weekly, monthly] = await Promise.all([
    listWorkflowRuns("weekly-seo-sync.yml", 3),
    listWorkflowRuns("monthly-seo-sync.yml", 3),
  ]);

  if (!weekly.ok && weekly.reason === "missing_token") {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Automation</h1>
            <p className="page-subtitle">Trigger and check the weekly/monthly sync without leaving the app</p>
          </div>
        </div>
        <div className="card">
          <h2 className="card-title">One-time setup: a GitHub personal access token</h2>
          <p className="empty-state" style={{ marginBottom: "var(--space-4)" }}>
            This page calls GitHub&apos;s API to trigger and check the same two workflows you&apos;d otherwise
            manage from GitHub&apos;s Actions tab. It needs its own token — separate from the 7 secrets already in
            GitHub Actions, since this one is used by the app itself, not by the workflow runs.
          </p>
          <ol style={{ paddingLeft: "var(--space-5)", fontSize: "var(--text-sm)", color: "var(--color-ink-muted)", lineHeight: 1.9 }}>
            <li>GitHub → your profile photo → <strong>Settings</strong> → <strong>Developer settings</strong> → <strong>Personal access tokens</strong> → <strong>Fine-grained tokens</strong> → <strong>Generate new token</strong></li>
            <li>Resource owner: <strong>JKDev444</strong>. Repository access: <strong>Only select repositories</strong> → <strong>omni-seo</strong>.</li>
            <li>Under Permissions → Repository permissions, set <strong>Actions</strong> to <strong>Read and write</strong>.</li>
            <li>Generate it, copy the token, and add it as <code>GITHUB_TOKEN</code> in Vercel (Project → Settings → Environment Variables) — and in your local <code>.env</code> if you want this page to work in local dev too.</li>
            <li>Redeploy (or wait for the next auto-deploy) and reload this page.</li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Automation</h1>
          <p className="page-subtitle">Trigger and check the weekly/monthly sync without leaving the app</p>
        </div>
      </div>

      <div className="section card">
        <h2 className="card-title">Weekly SEO Sync</h2>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--color-ink-muted)" }}>
          Full crawl, indexation check, Core Web Vitals, keyword rank checks, scorecard update. Runs automatically
          every Monday — use this to run it sooner, or to confirm it&apos;s wired up correctly.
        </p>
        <WorkflowTriggerButton kind="weekly" />
        {weekly.ok ? <RunsList runs={weekly.data} /> : <p style={{ color: "var(--color-critical)", fontSize: "var(--text-sm)" }}>{weekly.message}</p>}
      </div>

      <div className="section card">
        <h2 className="card-title">Monthly SEO Sync</h2>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--color-ink-muted)" }}>
          LLM content review, AI Search Readiness, CTR rewrites, content-stack clustering, backlinks, keyword
          discovery, and the written client report. Runs automatically on the 1st of the month.
        </p>
        <div className="callout" style={{ background: "var(--color-warning-soft)", border: "1px solid var(--color-warning)", borderRadius: "var(--radius-md)", padding: "var(--space-3)", margin: "var(--space-2) 0" }}>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-warning)", margin: 0 }}>
            Spends real money (Anthropic + DataForSEO API calls) every time it runs — only trigger this manually
            when you actually mean to, not to test the button.
          </p>
        </div>
        <WorkflowTriggerButton kind="monthly" />
        {monthly.ok ? <RunsList runs={monthly.data} /> : <p style={{ color: "var(--color-critical)", fontSize: "var(--text-sm)" }}>{monthly.ok === false ? monthly.message : ""}</p>}
      </div>
    </div>
  );
}
