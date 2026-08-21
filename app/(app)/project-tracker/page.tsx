import { getProjectTrackerData, type TrackerTask } from "@/lib/data/projectTracker";
import { setTaskStatus } from "@/lib/actions/projectTrackerActions";
import type { ProjectPhaseStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const PHASE_STATUS_LABEL: Record<ProjectPhaseStatus, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  PARTIAL: "Partial",
  COMPLETE: "Complete",
  SKIPPED: "Skipped",
  OUT_OF_SCOPE: "Out of scope",
};

const PHASE_STATUS_COLOR: Record<ProjectPhaseStatus, string> = {
  NOT_STARTED: "var(--color-ink-faint)",
  IN_PROGRESS: "#b8860b",
  PARTIAL: "#b8860b",
  COMPLETE: "#1a7f37",
  SKIPPED: "var(--color-ink-faint)",
  OUT_OF_SCOPE: "var(--color-ink-faint)",
};

function fmtDate(d: Date | null): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d);
}

function TaskRow({ task }: { task: TrackerTask }) {
  const markDone = setTaskStatus.bind(null, task.id, "DONE");
  const markTodo = setTaskStatus.bind(null, task.id, "TODO");
  const checked = task.status === "DONE";
  const skipped = task.status === "SKIPPED";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: "var(--space-3)",
        padding: "var(--space-2) 0",
        borderBottom: "1px solid var(--color-border)",
        opacity: skipped ? 0.6 : 1,
      }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <span style={{ fontSize: "var(--text-sm)", textDecoration: checked ? "line-through" : "none", color: checked ? "var(--color-ink-faint)" : "var(--color-ink)" }}>
            {task.title}
          </span>
          {skipped && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--color-ink-faint)" }}>
              (skipped)
            </span>
          )}
          {task.status === "IN_PROGRESS" && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "#b8860b" }}>in progress</span>
          )}
        </div>
        {task.notes && (
          <p style={{ fontSize: "var(--text-xs)", color: "var(--color-ink-faint)", margin: "2px 0 0" }}>{task.notes}</p>
        )}
        {checked && task.completedAt && (
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--color-ink-faint)", margin: "2px 0 0" }}>
            completed {fmtDate(task.completedAt)}
          </p>
        )}
      </div>
      {!skipped && (
        <form action={checked ? markTodo : markDone}>
          <button type="submit" className={checked ? "action-btn" : "action-btn action-btn-done"}>
            {checked ? "Undo" : "Mark done"}
          </button>
        </form>
      )}
    </div>
  );
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
      <div style={{ flex: 1, height: 6, borderRadius: 999, background: "var(--color-border)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? "#1a7f37" : "var(--color-accent, #4a6cf7)" }} />
      </div>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--color-ink-faint)", minWidth: 48, textAlign: "right" }}>
        {done}/{total}
      </span>
    </div>
  );
}

export default async function ProjectTrackerPage() {
  const data = await getProjectTrackerData();

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Project Tracker</h1>
          <p className="page-subtitle">Every build phase, what&apos;s done, what&apos;s left — updated as work happens</p>
        </div>
        <div className="page-meta">
          {data.overall.done}/{data.overall.total} tasks complete ({data.overall.percent}%)
        </div>
      </div>

      <div className="section card" style={{ marginBottom: "var(--space-4)" }}>
        <ProgressBar done={data.overall.done} total={data.overall.total} />
      </div>

      {data.phases.map((phase) => (
        <div key={phase.id} className="section card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-3)", marginBottom: "var(--space-2)" }}>
            <div>
              <h2 className="card-title">
                {phase.key} — {phase.name}
              </h2>
              {phase.summary && <p style={{ fontSize: "var(--text-sm)", color: "var(--color-ink-muted)", margin: "2px 0 0" }}>{phase.summary}</p>}
            </div>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-xs)",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.02em",
                color: PHASE_STATUS_COLOR[phase.status],
                whiteSpace: "nowrap",
              }}
            >
              {PHASE_STATUS_LABEL[phase.status]}
            </span>
          </div>

          {phase.totalCount > 0 && (
            <div style={{ marginBottom: "var(--space-2)" }}>
              <ProgressBar done={phase.doneCount} total={phase.totalCount} />
            </div>
          )}

          <div>
            {phase.tasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
