/**
 * The exact Week 1-4 task list from the "Monthly Maintenance" tab of
 * SEO_Operating_Tracker.xlsx, adapted only where the tracker names
 * SearchAtlas directly — this project replaces SearchAtlas with Omni SEO's
 * own crawler and NAP check, so those two lines reference this tool
 * instead. Everything else is verbatim.
 */

export interface MaintenanceTaskTemplate {
  week: 1 | 2 | 3 | 4;
  area: string;
  task: string;
}

export const MONTHLY_MAINTENANCE_TEMPLATE: MaintenanceTaskTemplate[] = [
  // Week 1: Technical Crawl
  { week: 1, area: "Technical Crawl", task: "Run Omni SEO crawl and review new findings; compare score vs. last month" },
  { week: 1, area: "Technical Crawl", task: "Check GSC indexing, sitemap, crawl errors, pages losing impressions" },
  { week: 1, area: "Technical Crawl", task: "Fix urgent redirects, 404s, duplicate title/meta, schema errors from crawl" },
  { week: 1, area: "Technical Crawl", task: "Check Core Web Vitals (LCP/INP/CLS) mobile" },

  // Week 2: Content + On-Page
  { week: 2, area: "Content + On-Page", task: "Update 3–5 priority pages: intro, headings, FAQ, internal links, trust, CTAs" },
  { week: 2, area: "Content + On-Page", task: "Publish at least one high-intent post/guide (cost, comparison, prep, aftercare, FAQs)" },
  { week: 2, area: "Content + On-Page", task: "Add internal links from high-authority pages/blogs to priority pages and new content" },
  { week: 2, area: "Content + On-Page", task: "Compress new images, verify alt text, no oversized media added" },
  { week: 2, area: "Content + On-Page", task: "Validate schema on updated templates in Rich Results Test" },

  // Week 3: Local SEO + Authority
  { week: 3, area: "Local SEO + Authority", task: "GBP: add photos/posts, check services/categories/hours, answer Q&A" },
  { week: 3, area: "Local SEO + Authority", task: "Request new reviews; reply to every new review" },
  { week: 3, area: "Local SEO + Authority", task: "Check top citation status, NAP consistency (Omni SEO NAP check), indexation of new listings" },
  { week: 3, area: "Local SEO + Authority", task: "Check 10–20 priority citation URLs for indexation progress" },
  { week: 3, area: "Local SEO + Authority", task: "Review top 3 local competitors: content, services, GBP, reviews, citations" },
  { week: 3, area: "Local SEO + Authority", task: "Review AI visibility — note which pages/competitors are cited by AI answer tools" },

  // Week 4: Reporting + Planning
  { week: 4, area: "Reporting + Planning", task: "Compile rank changes, leads/calls, GSC clicks/impressions, Omni SEO technical score" },
  { week: 4, area: "Reporting + Planning", task: "Send plain-English client report: wins, remaining issues, next month priorities" },
  { week: 4, area: "Reporting + Planning", task: "Log this month's report in the Client Report Log" },
  { week: 4, area: "Reporting + Planning", task: "Set next month's top-priority fix list" },
];
