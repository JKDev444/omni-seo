/**
 * Lets the app itself trigger and check the two GitHub Actions workflows
 * (weekly/monthly SEO sync) via GitHub's REST API, so triggering a manual
 * run doesn't require leaving the app to use GitHub's Actions tab. This is
 * a separate credential (GITHUB_TOKEN, a personal access token) from the
 * GitHub Actions secrets the workflows themselves use -- those still have
 * to live in GitHub's own secret store, since that's what the workflow
 * runs read from. This token just needs permission to dispatch/read runs
 * on this one repo.
 */
const GITHUB_API_BASE = "https://api.github.com";
const REPO = process.env.GITHUB_REPO ?? "JKDev444/omni-seo";

export type GithubResult<T> = { ok: true; data: T } | { ok: false; reason: "missing_token" | "api_error"; message: string };

function authHeaders(): Record<string, string> | null {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return null;
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export async function triggerWorkflow(workflowFile: string, ref = "main"): Promise<GithubResult<null>> {
  const headers = authHeaders();
  if (!headers) return { ok: false, reason: "missing_token", message: "GITHUB_TOKEN is not set." };

  try {
    const res = await fetch(`${GITHUB_API_BASE}/repos/${REPO}/actions/workflows/${workflowFile}/dispatches`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ ref }),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 204) return { ok: true, data: null };
    const text = await res.text();
    return { ok: false, reason: "api_error", message: `GitHub returned ${res.status}: ${text.slice(0, 300)}` };
  } catch (err) {
    return { ok: false, reason: "api_error", message: err instanceof Error ? err.message : String(err) };
  }
}

export interface WorkflowRun {
  id: number;
  status: string; // queued | in_progress | completed
  conclusion: string | null; // success | failure | cancelled | null (null while not yet completed)
  createdAt: string;
  htmlUrl: string;
}

export async function listWorkflowRuns(workflowFile: string, limit = 3): Promise<GithubResult<WorkflowRun[]>> {
  const headers = authHeaders();
  if (!headers) return { ok: false, reason: "missing_token", message: "GITHUB_TOKEN is not set." };

  try {
    const res = await fetch(`${GITHUB_API_BASE}/repos/${REPO}/actions/workflows/${workflowFile}/runs?per_page=${limit}`, {
      headers,
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { ok: false, reason: "api_error", message: `GitHub returned ${res.status}` };
    const json = await res.json();
    const runs = (json.workflow_runs ?? []) as Array<{ id: number; status: string; conclusion: string | null; created_at: string; html_url: string }>;
    return {
      ok: true,
      data: runs.map((r) => ({ id: r.id, status: r.status, conclusion: r.conclusion, createdAt: r.created_at, htmlUrl: r.html_url })),
    };
  } catch (err) {
    return { ok: false, reason: "api_error", message: err instanceof Error ? err.message : String(err) };
  }
}
