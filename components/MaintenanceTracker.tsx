interface MaintenanceTaskRow {
  id: string;
  week: number;
  area: string;
  task: string;
  status: string;
  owner: string | null;
}

function statusClass(status: string): string {
  if (status === "done") return "status-completed";
  if (status === "in_progress") return "status-pending";
  return "";
}

function statusLabel(status: string): string {
  if (status === "done") return "Done";
  if (status === "in_progress") return "In progress";
  return "Not started";
}

export function MaintenanceTracker({
  month,
  activeWeek,
  tasks,
}: {
  month: string;
  activeWeek: number;
  tasks: MaintenanceTaskRow[];
}) {
  const weeks = [1, 2, 3, 4];

  return (
    <div className="card" id="maintenance">
      <h2 className="card-title">Monthly maintenance — {month || "—"}</h2>
      {tasks.length === 0 ? (
        <p className="empty-state">No maintenance tasks seeded yet.</p>
      ) : (
        weeks.map((week) => {
          const weekTasks = tasks.filter((t) => t.week === week);
          if (weekTasks.length === 0) return null;
          const done = weekTasks.filter((t) => t.status === "done").length;
          return (
            <div className="findings-group" key={week}>
              <div className="findings-group-header">
                <span className={`tier-badge ${week === activeWeek ? "tier-medium" : "tier-low"}`}>
                  Week {week}
                  {week === activeWeek ? " · active" : ""}
                </span>
                <span className="findings-group-count">
                  {done}/{weekTasks.length} done
                </span>
              </div>
              {weekTasks.map((t) => (
                <div className="finding-row" key={t.id}>
                  <div className="finding-title">{t.task}</div>
                  <div className="finding-meta">
                    <span className={statusClass(t.status)}>{statusLabel(t.status)}</span>
                    <span>{t.area}</span>
                    {t.owner && <span>owner: {t.owner}</span>}
                  </div>
                </div>
              ))}
            </div>
          );
        })
      )}
    </div>
  );
}
