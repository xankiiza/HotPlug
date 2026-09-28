/**
 * Lightweight agent browser (separate from provider chat profiles).
 * Used by the browser_navigate tool.
 */
export class AgentBrowser {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async ensure() {
    if (this.page && !this.page.isClosed()) return this.page;
    const { chromium } = await import('playwright');
    this.browser = await chromium.launch({
      headless: process.env.HOTPLUG_HEADLESS !== 'false',
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    const context = await this.browser.newContext({ viewport: { width: 1280, height: 800 } });
    this.page = await context.newPage();
    return this.page;
  }

  async navigate({ url, extract = 'text' }) {
    const page = await this.ensure();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    if (extract === 'title') return { url: page.url(), title: await page.title() };
    const text = await page.locator('body').innerText().catch(() => '');
    return { url: page.url(), title: await page.title(), text: text.slice(0, 15000) };
  }

  async close() {
    await this.browser?.close().catch(() => {});
    this.browser = null;
    this.page = null;
  }
}
