/**
 * Rendered-DOM capture — runs a single headless Chromium instance across
 * the whole crawl (one launch, many pages) rather than one browser per
 * page. On Vercel's serverless functions this will need to swap to
 * @sparticuz/chromium once the crawl is wired into a Cron endpoint
 * (playwright's bundled Chromium doesn't fit the serverless bundle size
 * limit) — this module's public shape stays the same either way.
 */
import { chromium, type Browser } from "playwright";

export async function withRenderer<T>(
  fn: (renderPage: (url: string) => Promise<string | null>) => Promise<T>
): Promise<T> {
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (err) {
    // No usable Chromium in this environment — degrade gracefully rather
    // than fail the whole crawl. Callers get null renders and should skip
    // rendered-DOM-dependent checks, not crash.
    console.error("Rendered-DOM capture unavailable:", err instanceof Error ? err.message : err);
    return fn(async () => null);
  }

  try {
    const renderPage = async (url: string): Promise<string | null> => {
      const page = await browser!.newPage();
      try {
        await page.goto(url, { waitUntil: "networkidle", timeout: 20000 });
        return await page.content();
      } catch {
        return null;
      } finally {
        await page.close();
      }
    };
    return await fn(renderPage);
  } finally {
    await browser.close();
  }
}
