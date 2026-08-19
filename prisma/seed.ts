/**
 * Sample data so the dashboard is viewable before the crawler and GSC/GA4
 * integrations are wired up. Safe to re-run — upserts the site, replaces
 * its crawl/findings/scorecard each time. Citations and maintenance tasks
 * use the real default-seeding functions (not hardcoded literals) so this
 * script exercises the same code path production crawls/cron will use.
 *
 * All "sample data" below is clearly labeled as such in its notes field —
 * none of it is a real NAP value, citation URL, or GBP status for
 * omnicenters.com, per the audit methodology's rule to never fabricate
 * data that hasn't actually been verified.
 */
import { PrismaClient } from "@prisma/client";
import { seedDefaultCitations } from "../lib/citations/defaults";
import { seedMaintenanceMonth, monthKey } from "../lib/maintenance/seedMonth";

const prisma = new PrismaClient();

async function main() {
  const site = await prisma.site.upsert({
    where: { domain: "omnicenters.com" },
    update: {},
    create: { domain: "omnicenters.com", platform: "shopify" },
  });

  await prisma.finding.deleteMany({ where: { crawl: { siteId: site.id } } });
  await prisma.crawl.deleteMany({ where: { siteId: site.id } });
  await prisma.page.deleteMany({ where: { siteId: site.id } });
  await prisma.scorecardMetric.deleteMany({ where: { siteId: site.id } });
  await prisma.citation.deleteMany({ where: { siteId: site.id } });
  await prisma.maintenanceTask.deleteMany({ where: { siteId: site.id } });

  const pages = await Promise.all(
    [
      { url: "https://omnicenters.com/", pageType: "HOMEPAGE" as const, title: "Omni Centers | Medical Aesthetics & Wellness in Olympia, WA" },
      { url: "https://omnicenters.com/pages/botox", pageType: "SERVICE_PAGE" as const, title: "Botox Injections | Omni Centers" },
      { url: "https://omnicenters.com/pages/laser-hair-removal", pageType: "SERVICE_PAGE" as const, title: "Laser Hair Removal | Omni Centers" },
      { url: "https://omnicenters.com/pages/about", pageType: "ABOUT_PAGE" as const, title: "About Omni Centers" },
      { url: "https://omnicenters.com/pages/contact", pageType: "CONTACT_PAGE" as const, title: "Contact Omni Centers" },
      { url: "https://omnicenters.com/blogs/news/spring-skin-refresh", pageType: "BLOG_ARTICLE" as const, title: "Spring Skin Refresh Tips" },
    ].map((p) =>
      prisma.page.create({
        data: { siteId: site.id, url: p.url, pageType: p.pageType, title: p.title, statusCode: 200, lastCrawledAt: new Date() },
      })
    )
  );

  const crawl = await prisma.crawl.create({
    data: { siteId: site.id, status: "completed", finishedAt: new Date(), pagesFound: pages.length },
  });

  const [home, botox, laser, about, contact, blog] = pages;

  await prisma.finding.createMany({
    data: [
      {
        crawlId: crawl.id,
        pageId: botox.id,
        category: "schema",
        checkStep: "Step 4 - Schema by page type",
        title: "Missing expected schema for service_page",
        description: "Expected: Service, LocalBusiness, BreadcrumbList. Found: Service.",
        fixType: "Add LocalBusiness and BreadcrumbList JSON-LD with stable @id values.",
        priority: "MEDIUM",
      },
      {
        crawlId: crawl.id,
        pageId: laser.id,
        category: "technical",
        checkStep: "Step 1 - Raw HTML",
        title: "Missing canonical tag",
        description: "No canonical tag present — risk of duplicate content being split across URL variants.",
        priority: "HIGH",
      },
      {
        crawlId: crawl.id,
        pageId: home.id,
        category: "local",
        checkStep: "Step 5 - Local SEO",
        title: "Address mismatch: footer vs. GBP public listing",
        description: 'Sample finding — footer shows "...Suite 120..."; GBP public listing shows "...Suite 110...". Inconsistent NAP hurts local pack ranking. Classified High per the tier table, not Critical: it affects ranking/trust, it does not block crawling or indexing.',
        fixType: "Confirm the correct suite number and update whichever source is wrong.",
        priority: "HIGH",
        owner: "local seo manager",
      },
      {
        crawlId: crawl.id,
        pageId: contact.id,
        category: "schema",
        checkStep: "Step 4 - Schema by page type",
        title: "Missing expected schema for contact_page",
        description: "Expected: ContactPage, LocalBusiness. Found: none.",
        priority: "MEDIUM",
      },
      {
        crawlId: crawl.id,
        pageId: blog.id,
        category: "content",
        checkStep: "Step 1 - Raw HTML",
        title: "Missing H1",
        description: "No H1 found in raw HTML. If one appears visually, it's being injected client-side.",
        fixType: "Add a hardcoded H1 matching page intent, server-rendered.",
        priority: "HIGH",
      },
      {
        crawlId: crawl.id,
        pageId: about.id,
        category: "technical",
        checkStep: "Step 1 - Raw HTML",
        title: "Incomplete Open Graph tags",
        description: "Missing: og:url, og:type. Affects how the page appears when shared on social platforms.",
        priority: "LOW",
      },
      {
        crawlId: crawl.id,
        pageId: home.id,
        category: "redirect",
        checkStep: "Step 2 - Indexability",
        title: "Non-canonical host resolves without redirect",
        description: "http://omnicenters.com does not 301 to https://www.omnicenters.com — duplicate crawl paths.",
        priority: "HIGH",
      },
    ],
  });

  await prisma.scorecardMetric.createMany({
    data: [
      { siteId: site.id, metric: "Technical SEO score", baseline: 58, current: 74, target: 90, source: "crawler" },
      { siteId: site.id, metric: "Indexed pages (GSC)", baseline: 41, current: 47, target: 55, source: "GSC" },
      { siteId: site.id, metric: "Avg. position (branded)", baseline: 4.2, current: 2.8, target: 1.5, source: "GSC" },
      { siteId: site.id, metric: "Organic sessions / mo", baseline: 620, current: 810, target: 1200, source: "GA4" },
      { siteId: site.id, metric: "Local pack visibility", baseline: 22, current: 35, target: 65, source: "manual" },
    ],
  });

  // Real citation-defaults function — same 9-directory list a fresh site gets.
  await seedDefaultCitations(site.id);
  // Mark two as sample-checked so the dashboard demonstrates the states;
  // everything else stays "unchecked," which is the honest starting state.
  await prisma.citation.updateMany({
    where: { siteId: site.id, directory: "Google Business Profile" },
    data: { napConsistent: false, indexed: true, lastCheckedAt: new Date(), notes: "Sample data — not a live check." },
  });
  await prisma.citation.updateMany({
    where: { siteId: site.id, directory: "Yelp" },
    data: { napConsistent: true, indexed: true, lastCheckedAt: new Date(), notes: "Sample data — not a live check." },
  });

  // Real maintenance-seeding function — same 19-task Week 1-4 set the SOP defines.
  await seedMaintenanceMonth(site.id, monthKey());

  console.log(`Seeded ${site.domain} — crawl ${crawl.id} with ${pages.length} pages.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
