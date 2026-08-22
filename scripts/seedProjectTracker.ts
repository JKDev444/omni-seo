/**
 * Seeds/updates the Project Tracker board. Safe to re-run: phases and
 * tasks are upserted by their unique key/title, and the upsert's
 * `update` clause is empty on purpose -- re-running this must never
 * overwrite a status a person or a later task-completion actually set.
 * Add new phases/tasks here as the project grows; existing rows are
 * left alone.
 *
 * Run: `npx tsx scripts/seedProjectTracker.ts`
 */
import { PrismaClient, ProjectPhaseStatus, ProjectTaskStatus } from "@prisma/client";

const prisma = new PrismaClient();

interface TaskSeed {
  title: string;
  status: ProjectTaskStatus;
  notes?: string;
}

interface PhaseSeed {
  key: string;
  name: string;
  summary: string;
  status: ProjectPhaseStatus;
  tasks: TaskSeed[];
}

const DONE = ProjectTaskStatus.DONE;
const TODO = ProjectTaskStatus.TODO;
const SKIPPED = ProjectTaskStatus.SKIPPED;

const PHASES: PhaseSeed[] = [
  {
    key: "A",
    name: "Auth",
    summary: "NextAuth Credentials login, no public signup.",
    status: ProjectPhaseStatus.COMPLETE,
    tasks: [
      { title: "NextAuth Credentials provider wired up", status: DONE },
      { title: "ALLOWED_EMAILS set in Vercel, sign-in confirmed live", status: DONE },
    ],
  },
  {
    key: "B",
    name: "Data Foundation",
    summary: "Crawl snapshots, Finding model, multi-dimensional scoring.",
    status: ProjectPhaseStatus.COMPLETE,
    tasks: [
      { title: "Crawl snapshots store raw HTML + rendered DOM per page", status: DONE },
      { title: "Finding model: severity, fixLocation, source, full status workflow", status: DONE },
      { title: "Multi-dimensional health scoring (Technical/Local/Content rings)", status: DONE },
    ],
  },
  {
    key: "C",
    name: "Technical SEO Engine",
    summary: "Redirects, canonicals, robots, duplicate titles/meta, thin content.",
    status: ProjectPhaseStatus.COMPLETE,
    tasks: [
      { title: "Redirect chain / loop detection", status: DONE },
      { title: "Canonical + robots/X-Robots-Tag conflict checks", status: DONE },
      { title: "Duplicate title/meta description detection", status: DONE },
      { title: "Thin content detection", status: DONE },
    ],
  },
  {
    key: "D",
    name: "GSC + GA4 Analytics",
    summary: "/analytics page with real Search Console + GA4 data.",
    status: ProjectPhaseStatus.COMPLETE,
    tasks: [{ title: "GSC + GA4 integrations live with real data on /analytics", status: DONE }],
  },
  {
    key: "E",
    name: "Indexation Control Center",
    summary: "Google's real per-URL index status via URL Inspection API.",
    status: ProjectPhaseStatus.COMPLETE,
    tasks: [
      { title: "URL Inspection API integration", status: DONE },
      { title: "Indexed / Not Indexed / Blocked / Not Yet Discovered buckets", status: DONE, notes: "Fixed false-positive bucketing of INDEXING_STATE_UNSPECIFIED into Blocked" },
    ],
  },
  {
    key: "F",
    name: "Core Web Vitals",
    summary: "CrUX field data + PSI lab data on /performance.",
    status: ProjectPhaseStatus.PARTIAL,
    tasks: [
      { title: "CrUX + PageSpeed Insights integrations live", status: DONE },
      { title: "Real CrUX field data for omnicenters.com", status: SKIPPED, notes: "Site's real-user Chrome traffic is below CrUX's publish threshold -- confirmed via the API directly, not a code issue" },
    ],
  },
  {
    key: "G",
    name: "Internal Link Graph",
    summary: "Orphan pages, crawl depth, under-linked money pages, /internal-links.",
    status: ProjectPhaseStatus.COMPLETE,
    tasks: [{ title: "Internal link graph analysis + findings live", status: DONE }],
  },
  {
    key: "H",
    name: "Content Depth / E-E-A-T",
    summary: "LLM-assisted content quality review, /content.",
    status: ProjectPhaseStatus.COMPLETE,
    tasks: [{ title: "LLM content review pipeline live with real data", status: DONE }],
  },
  {
    key: "I",
    name: "Keyword Tracking",
    summary: "Rank tracking, cannibalization, decay, CTR opportunities, /keywords.",
    status: ProjectPhaseStatus.COMPLETE,
    tasks: [
      { title: "DataForSEO SERP rank tracking live", status: DONE },
      { title: "Cannibalization / content decay / CTR opportunity detection", status: DONE },
    ],
  },
  {
    key: "J",
    name: "Content Stacks",
    summary: "Topical authority clustering, /content-stacks.",
    status: ProjectPhaseStatus.COMPLETE,
    tasks: [{ title: "Content stack clustering + completeness scoring live", status: DONE }],
  },
  {
    key: "K",
    name: "Local SEO + GBP",
    summary: "NAP consistency (Places API) live; GBP Performance API skipped.",
    status: ProjectPhaseStatus.SKIPPED,
    tasks: [
      { title: "Places API NAP consistency check", status: DONE },
      { title: "GBP Performance API (impressions/calls/clicks, review replies)", status: SKIPPED, notes: "Deliberately not applied for -- additive, not foundational" },
    ],
  },
  {
    key: "L",
    name: "Backlinks",
    summary: "Backlink profile + competitor gap outreach list, /backlinks.",
    status: ProjectPhaseStatus.COMPLETE,
    tasks: [{ title: "DataForSEO backlinks + competitor gap analysis live", status: DONE }],
  },
  {
    key: "M",
    name: "Schema Validation Engine",
    summary: "Required properties, entity consistency, systemic gap detection.",
    status: ProjectPhaseStatus.PARTIAL,
    tasks: [
      { title: "Required schema properties per page type", status: DONE },
      { title: "LocalBusiness/Organization @id consistency check", status: DONE },
      { title: "Systemic schema gap detection (shared-template bug -> 1 finding, not N)", status: DONE },
      { title: "Schema-vs-visible-content mismatch check", status: TODO },
      { title: "Schema URL redirect check", status: TODO },
      { title: "Rich Results Test eligibility (separate from Schema.org validity)", status: TODO },
    ],
  },
  {
    key: "N",
    name: "AI Search Readiness",
    summary: "Entity clarity, citation readiness, extractability, /ai-search.",
    status: ProjectPhaseStatus.COMPLETE,
    tasks: [{ title: "LLM-assisted AI Search Readiness pipeline live", status: DONE }],
  },
  {
    key: "O",
    name: "Shopify / E-commerce Specifics",
    summary: "Product/variant/Merchant Center checks.",
    status: ProjectPhaseStatus.OUT_OF_SCOPE,
    tasks: [{ title: "Product-page-specific checks", status: SKIPPED, notes: "Omni Centers is a services business with no products" }],
  },
  {
    key: "P",
    name: "Guided Roadmap (Action Plan)",
    summary: "Unified Do Now / This Month / Ongoing action plan -- the real homepage.",
    status: ProjectPhaseStatus.PARTIAL,
    tasks: [
      { title: "Unified Action Plan as post-login landing page", status: DONE },
      { title: "In-app mark done / ignore / false positive buttons", status: DONE },
      { title: "Status carries forward across crawls (IGNORED/FALSE_POSITIVE/ACCEPTED)", status: DONE },
      { title: "30/60/90-day roadmap framing", status: TODO },
      { title: "Platform-specific exact fix instructions beyond fixType", status: TODO },
    ],
  },
  {
    key: "Q",
    name: "Reporting",
    summary: "Real Scorecard + monthly LLM-written client report, /reports.",
    status: ProjectPhaseStatus.COMPLETE,
    tasks: [
      { title: "Scorecard computed from real crawl/GSC/GA4/keyword data", status: DONE },
      { title: "Monthly LLM-written client report generation", status: DONE },
    ],
  },
  {
    key: "R",
    name: "Automation + Regression Detection",
    summary: "Scheduled sync + crawl-to-crawl regression detection.",
    status: ProjectPhaseStatus.PARTIAL,
    tasks: [
      { title: "Scheduled crawl + data sync automation", status: DONE },
      { title: "Regression detection (title/meta/H1/canonical/schema loss)", status: DONE },
      { title: "Full SEO change tracking changelog (every field change, not just regressions)", status: TODO },
      { title: "Deployment verification gate (pre/post-deploy audit diff)", status: TODO },
    ],
  },
  {
    key: "S",
    name: "Auto-Fix / Agentic Remediation",
    summary: "Long-term: find issue -> generate fix -> open PR -> re-audit.",
    status: ProjectPhaseStatus.NOT_STARTED,
    tasks: [{ title: "Agentic auto-fix pipeline", status: TODO, notes: "Not started intentionally -- everything before it should be solid first" }],
  },
  {
    key: "T",
    name: "Multi-Site Support",
    summary: "Onboard a second real site (esco-pacific.com) -- replace the hardcoded V1_DOMAIN with real site selection.",
    status: ProjectPhaseStatus.NOT_STARTED,
    tasks: [
      { title: "Replace V1_DOMAIN hardcode with a real site-selection mechanism across every page/data function", status: TODO },
      { title: "Site switcher in the sidebar (or per-site subdomain/route)", status: TODO },
      { title: "Onboard esco-pacific.com as a second real Site row and run its first crawl", status: TODO },
      { title: "Verify every page degrades gracefully for a site with little/no crawl history yet", status: TODO },
    ],
  },
  {
    key: "U",
    name: "UI/UX Design Polish",
    summary: "A real design pass so the app feels like a modern SaaS product, not a functional internal tool.",
    status: ProjectPhaseStatus.NOT_STARTED,
    tasks: [
      { title: "Design direction / visual system pass (beyond the current functional card/table styling)", status: TODO },
      { title: "Navigation and information architecture review now that multi-site exists", status: TODO },
      { title: "Responsive/mobile pass", status: TODO },
    ],
  },
  {
    key: "V",
    name: "Change Pacing / Drip-Feed Intelligence",
    summary: "Research-backed guidance on WHEN to make changes (rollout pacing, backlink outreach velocity), not just what to fix.",
    status: ProjectPhaseStatus.NOT_STARTED,
    tasks: [
      { title: "Research real guidance on SEO change velocity and backlink outreach pacing before designing anything", status: TODO },
      { title: "Design a pacing/scheduling layer on top of the existing 30/60/90-day roadmap", status: TODO },
      { title: "Surface suggested rollout dates/spacing in the Action Plan", status: TODO },
    ],
  },
  {
    key: "W",
    name: "AI Chat Assistant",
    summary: "A SearchAtlas-style chat over the site's real findings/action-plan data (\"What are today's tasks?\").",
    status: ProjectPhaseStatus.NOT_STARTED,
    tasks: [
      { title: "Design the chat's data access (read-only over Finding/ActionPlan/Scorecard, scoped to the selected site)", status: TODO },
      { title: "Build the chat UI + Anthropic-backed query handling", status: TODO },
      { title: "Verify answers stay grounded in real data (no fabricated numbers, same discipline as the Scorecard/Citation fixes)", status: TODO },
    ],
  },
  {
    key: "AUDIT",
    name: "Accuracy Audit",
    summary: "Ongoing: sample real findings from every check category and verify each against live data.",
    status: ProjectPhaseStatus.IN_PROGRESS,
    tasks: [
      { title: "Fix cross-crawl finding visibility bug (Dashboard/Action Plan hid orphaned findings)", status: DONE },
      { title: "Fix findings never auto-resolving (stale PENDING findings for since-fixed issues)", status: DONE },
      { title: "Fix utility pages (privacy policy, terms, thank-you) misclassified as service pages", status: DONE },
      { title: "Verify Schema + Raw HTML findings against live site", status: DONE },
      { title: "Verify Internal Link Graph + Local SEO NAP findings against live site", status: DONE },
      { title: "Spot-check Keyword rank data against live SERPs", status: DONE, notes: "Checked DB consistency; did not cross-verify individual positions against live Google results" },
      { title: "Audit Backlinks category against live data", status: TODO },
      { title: "Audit remaining Local SEO / GBP findings against live data", status: TODO },
    ],
  },
];

async function main() {
  for (const p of PHASES) {
    const phase = await prisma.projectPhase.upsert({
      where: { key: p.key },
      update: {},
      create: { key: p.key, name: p.name, summary: p.summary, order: PHASES.indexOf(p), status: p.status },
    });

    for (const [i, t] of p.tasks.entries()) {
      await prisma.projectTask.upsert({
        where: { phaseId_title: { phaseId: phase.id, title: t.title } },
        update: {},
        create: {
          phaseId: phase.id,
          title: t.title,
          status: t.status,
          notes: t.notes,
          order: i,
          completedAt: t.status === "DONE" ? new Date() : null,
        },
      });
    }
  }

  const phaseCount = await prisma.projectPhase.count();
  const taskCount = await prisma.projectTask.count();
  console.log(`Seeded/verified ${phaseCount} phases, ${taskCount} tasks.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
