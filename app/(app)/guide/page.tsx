const RECOMMENDATION_COLORS = {
  ok: { background: "var(--color-success-soft)", color: "var(--color-success)" },
  warn: { background: "var(--color-warning-soft)", color: "var(--color-warning)" },
  note: { background: "var(--color-surface-sunken)", color: "var(--color-ink-muted)" },
} as const;

function Callout({ tone, title, children }: { tone: keyof typeof RECOMMENDATION_COLORS; title: string; children: React.ReactNode }) {
  return (
    <div style={{ ...RECOMMENDATION_COLORS[tone], borderRadius: "var(--radius-md)", padding: "var(--space-3) var(--space-4)", margin: "var(--space-3) 0" }}>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600, margin: "0 0 4px" }}>
        {title}
      </p>
      <div style={{ fontSize: "var(--text-sm)" }}>{children}</div>
    </div>
  );
}

const PAGE_REFERENCE: { path: string; when: string }[] = [
  { path: "/action-plan", when: "Home base — the post-login landing page. Do Now / This Month / Ongoing, everything prioritized for you." },
  { path: "/dashboard", when: "The full health-score breakdown behind Action Plan's numbers." },
  { path: "/analytics", when: "How traffic is doing — real GSC + GA4 trends." },
  { path: "/indexation", when: "A page isn't showing up in Google and you want to know exactly why." },
  { path: "/performance", when: "Page speed / Core Web Vitals." },
  { path: "/internal-links", when: "Which pages need more internal links pointing at them." },
  { path: "/content", when: "The AI's read on a page's content depth and trust signals." },
  { path: "/ai-search", when: "Whether a page is written so ChatGPT/AI Overviews can quote it." },
  { path: "/keywords", when: "Rank tracking, cannibalization, CTR rewrite suggestions, and new keyword opportunities worth going after." },
  { path: "/content-stacks", when: "Planning content — which service clusters have gaps." },
  { path: "/backlinks", when: "Outreach targets — sites linking to competitors, not you." },
  { path: "/reports", when: "The monthly written summary for a stakeholder." },
  { path: "/change-log", when: "Something looks off and you want to know exactly what changed, and when." },
  { path: "/deploy-check", when: "Before publishing any Shopify theme change — see Common tasks below." },
  { path: "/automation", when: "Running the weekly or monthly sync right now instead of waiting for its schedule." },
  { path: "/project-tracker", when: "What's been built into this tool itself, and what hasn't." },
];

export default function GuidePage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Field Guide</h1>
          <p className="page-subtitle">Where to start, what runs on its own, and how to use this day to day</p>
        </div>
      </div>

      <div className="section card">
        <h2 className="card-title">Where to start, every time</h2>
        <p>
          Log in and you land on <strong>Action Plan</strong> — not a dashboard full of scores, a to-do list, organized
          the way you&apos;d actually work through it:
        </p>
        <ul style={{ paddingLeft: "var(--space-5)", lineHeight: 1.8 }}>
          <li><strong>Do Now</strong> — the highest-value fixes this week, ranked by real impact against real effort, not just severity.</li>
          <li><strong>This Month</strong> — content and outreach work with a realistic pace (a &quot;~3/week keeps this on pace&quot; note, not a wall of items).</li>
          <li><strong>Ongoing</strong> — recurring maintenance that never really finishes.</li>
        </ul>
        <p>
          Click any finding card to expand <strong>&quot;Exactly where to fix this&quot;</strong> — the real Shopify
          Admin path and steps. Mark things Done, Ignored, or False Positive right from the card; it remembers your
          call across future crawls.
        </p>
        <Callout tone="note" title="A realistic cadence">
          Fifteen minutes on Action Plan once a week is enough to stay on top of this. It&apos;s built to be skimmed,
          not studied.
        </Callout>
      </div>

      <div className="section card">
        <h2 className="card-title">What runs on its own</h2>
        <p style={{ color: "var(--color-ink-muted)", fontSize: "var(--text-sm)" }}>
          You don&apos;t trigger crawls or pull reports by hand — two schedules do it for you.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)", marginTop: "var(--space-3)" }}>
          <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-4)" }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--color-ink-faint)", textTransform: "uppercase" }}>Every Monday</p>
            <p style={{ fontWeight: 600, margin: "4px 0 8px" }}>The weekly sync</p>
            <ul style={{ paddingLeft: "var(--space-5)", fontSize: "var(--text-sm)", color: "var(--color-ink-muted)" }}>
              <li>Full site crawl — every page, every check</li>
              <li>Google&apos;s real index status per URL</li>
              <li>Core Web Vitals</li>
              <li>Keyword rank checks</li>
              <li>Search Console + Analytics numbers</li>
              <li>Scorecard recalculated</li>
            </ul>
          </div>
          <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-4)" }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--color-ink-faint)", textTransform: "uppercase" }}>1st of the month</p>
            <p style={{ fontWeight: 600, margin: "4px 0 8px" }}>The monthly sync</p>
            <ul style={{ paddingLeft: "var(--space-5)", fontSize: "var(--text-sm)", color: "var(--color-ink-muted)" }}>
              <li>AI-assisted content quality review</li>
              <li>AI Search Readiness scoring</li>
              <li>Title/description rewrite suggestions</li>
              <li>Content cluster / topical gap mapping</li>
              <li>Backlinks + competitor gap check</li>
              <li>New keyword opportunities (keyword discovery)</li>
              <li>The written monthly client report</li>
            </ul>
          </div>
        </div>
        <p style={{ marginTop: "var(--space-3)" }}>
          You&apos;ll know it worked because the pages simply show fresher numbers — nothing to click. See the Setup
          Checklist below for the one thing to verify before trusting this schedule.
        </p>
      </div>

      <div className="section card">
        <h2 className="card-title">Every page, and when to open it</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Page</th>
              <th>Open it when…</th>
            </tr>
          </thead>
          <tbody>
            {PAGE_REFERENCE.map((p) => (
              <tr key={p.path}>
                <td style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)", whiteSpace: "nowrap", color: "var(--color-accent)" }}>{p.path}</td>
                <td style={{ fontSize: "var(--text-sm)", color: "var(--color-ink-muted)" }}>{p.when}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section card">
        <h2 className="card-title">Common tasks</h2>

        <h3 style={{ fontSize: "var(--text-lg)", margin: "0 0 8px" }}>Before you publish a theme change</h3>
        <ol style={{ paddingLeft: "var(--space-5)", lineHeight: 1.9 }}>
          <li>In Shopify Admin, open the theme in <strong>Preview</strong> and copy its preview URL(s) — the ones with <code>?preview_theme_id=</code>.</li>
          <li>Paste them into <strong>Deploy Check</strong>, one per line, and run the check.</li>
          <li>It runs the same checks a real crawl runs against the preview, then diffs the result against the live production page at the same path.</li>
          <li>Zero regressions and only expected differences → safe to publish. Anything unexpected → fix it in the theme before you go live.</li>
        </ol>

        <h3 style={{ fontSize: "var(--text-lg)", margin: "var(--space-4) 0 8px" }}>Deciding what keywords to go after</h3>
        <ol style={{ paddingLeft: "var(--space-5)", lineHeight: 1.9 }}>
          <li>Open <strong>Keywords</strong> — the &quot;Keyword opportunities&quot; section lists real ideas the site doesn&apos;t track yet, refreshed monthly, each labeled <strong>Pursue</strong>, <strong>Consider</strong>, or <strong>Skip</strong> with the reasoning shown.</li>
          <li>Read the reasoning line — it explains why (volume, difficulty, whether it&apos;s locally relevant), not just a label.</li>
          <li>Click <strong>Track</strong> to start rank-checking it, or <strong>Dismiss</strong> if it&apos;s not a fit. That&apos;s it — no terminal needed.</li>
        </ol>

        <h3 style={{ fontSize: "var(--text-lg)", margin: "var(--space-4) 0 8px" }}>Something changed and you don&apos;t know why</h3>
        <p>
          Open <strong>Change Log</strong> — every title, meta description, canonical, H1, status code, and schema
          change is logged crawl-over-crawl. Regressions (things that got worse) also show up as findings on Action
          Plan automatically.
        </p>
      </div>

      <div className="section card">
        <h2 className="card-title">Asking the assistant</h2>
        <p>
          There&apos;s a chat bubble on every page. It answers from the same real numbers the rest of the app shows —
          nothing invented. Good questions to ask it: <em>&quot;What are today&apos;s top 3 tasks?&quot;</em>,{" "}
          <em>&quot;How many critical issues do I have right now?&quot;</em>,{" "}
          <em>&quot;What&apos;s my organic traffic trend this month?&quot;</em>. If it doesn&apos;t have the data to
          answer honestly, it says so instead of guessing.
        </p>
      </div>

      <div className="section card">
        <h2 className="card-title">Setup checklist — do this before you trust the schedule</h2>
        <p>
          The weekly and monthly syncs are fully built and every piece of them has been run and verified with real
          data — but the unattended, scheduled version of that pipeline has not yet fired on its own on GitHub.
        </p>
        <Callout tone="warn" title="Why this matters">
          If the schedule silently fails (a missing secret, a timeout), the app will quietly stop getting fresher
          data with nothing to tell you. This is a one-time, ten-minute fix.
        </Callout>
        <ol style={{ paddingLeft: "var(--space-5)", lineHeight: 2 }}>
          <li><strong>Add 7 secrets to GitHub</strong> — Repo → Settings → Secrets and variables → Actions. Copy the same 7 values already in your local <code>.env</code>: <code>DATABASE_URL</code>, <code>ANTHROPIC_API_KEY</code>, <code>DATAFORSEO_LOGIN</code>, <code>DATAFORSEO_PASSWORD</code>, <code>GOOGLE_SERVICE_ACCOUNT_KEY</code>, <code>GOOGLE_PAGESPEED_API_KEY</code>, <code>GOOGLE_PLACES_API_KEY</code>.</li>
          <li><strong>Trigger the weekly workflow manually once</strong> — from <strong>Automation</strong> in the sidebar (set up its <code>GITHUB_TOKEN</code> once via that page&apos;s instructions), or from GitHub&apos;s Actions tab → &quot;Weekly SEO Sync&quot; → Run workflow. Confirm it finishes green.</li>
          <li><strong>Trigger the monthly workflow manually once</strong> — same place, &quot;Monthly SEO Sync&quot;. This one spends real Anthropic + DataForSEO money, so once is enough to confirm it works.</li>
          <li><strong>Confirm <code>CRON_SECRET</code> is set in Vercel</strong> — Vercel project → Settings → Environment Variables.</li>
        </ol>
      </div>

      <div className="section card">
        <h2 className="card-title">Running a sync on demand</h2>
        <p>
          Open <strong>Automation</strong> in the sidebar. If it asks for a one-time <code>GITHUB_TOKEN</code>
          setup, follow the steps shown there (it&apos;s a separate credential from the 7 GitHub secrets above —
          this one lets the app itself call GitHub&apos;s API instead of you opening GitHub). Once set up, click{" "}
          <strong>Run now</strong> next to either sync and watch the run show up in the list below it — no need to
          leave the app.
        </p>
      </div>

      <div className="section card">
        <h2 className="card-title">What&apos;s not built yet — on purpose</h2>
        <p style={{ color: "var(--color-ink-muted)", fontSize: "var(--text-sm)" }}>
          Nothing here is broken. These are deliberate gaps, either waiting on a decision from you or intentionally
          deferred.
        </p>

        <h3 style={{ fontSize: "var(--text-lg)", margin: "var(--space-4) 0 8px" }}>Auto-fix / agentic remediation</h3>
        <p>
          The long-term version of this tool finds an issue, writes the code fix, opens a pull request, and
          re-checks itself. Not started intentionally — everything upstream of it needed to be solid and
          trustworthy first, which is roughly where things stand now.
        </p>

        <h3 style={{ fontSize: "var(--text-lg)", margin: "var(--space-4) 0 8px" }}>Esco Pacific (second site)</h3>
        <p>
          The multi-site architecture is done and tested — the app already knows how to run two sites side by side.
          Onboarding Esco itself needs from you: Search Console + Analytics access granted to the app&apos;s service
          account on Esco&apos;s properties, and a decision on DataForSEO spend for tracking a second site&apos;s
          keywords.
        </p>

        <h3 style={{ fontSize: "var(--text-lg)", margin: "var(--space-4) 0 8px" }}>Two known, harmless gaps</h3>
        <p>
          Core Web Vitals field data doesn&apos;t exist for omnicenters.com yet — the site&apos;s real-user Chrome
          traffic is below the volume Google&apos;s CrUX dataset requires to publish anything, confirmed directly
          against the API. Lab data (PageSpeed) still works fine. And the mobile nav drawer opens/closes instantly
          rather than sliding — cosmetic only.
        </p>
      </div>
    </div>
  );
}
