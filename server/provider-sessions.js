import fs from 'node:fs/promises';
import path from 'node:path';
import { providers } from './providers.js';

const profileName = id => `hotplug-${id}`;

export class ProviderSessionManager {
  constructor(root = process.env.HOTPLUG_DATA_DIR || path.resolve('data'), chromiumApi = null) {
    this.root = root;
    this.chromiumApi = chromiumApi;
    this.chromiumModule = null;
    this.contexts = new Map();
    this.browsers = new Map();
    this.queues = new Map();
    this.metrics = new Map();
    this.browserlessToken = process.env.HOTPLUG_BROWSERLESS_TOKEN || process.env.BROWSERLESS_TOKEN || '';
    this.browserlessOrigin = (process.env.HOTPLUG_BROWSERLESS_ORIGIN || process.env.BROWSERLESS_ORIGIN || 'https://production-sfo.browserless.io').replace(/\/$/, '');
  }

  get remote() { return Boolean(this.browserlessToken); }

  async chromium() {
    if (this.chromiumApi) return this.chromiumApi;
    if (!this.chromiumModule) {
      const { chromium } = await import('playwright');
      this.chromiumModule = chromium;
    }
    return this.chromiumModule;
  }

  wsEndpoint(id, { forLogin = false } = {}) {
    const url = new URL(this.browserlessOrigin.replace(/^http/, 'ws'));
    url.pathname = '/chromium';
    url.searchParams.set('token', this.browserlessToken);
    url.searchParams.set('timeout', forLogin ? '600000' : '300000');
    if (!forLogin) url.searchParams.set('profile', profileName(id));
    return url.toString();
  }

  async list() {
    return Promise.all(Object.entries(providers).map(async ([id, p]) => ({
      id,
      name: p.name,
      model: p.model,
      connected: await this.hasProfile(id),
      running: this.contexts.has(id),
      browser: this.remote ? 'browserless' : 'local',
    })));
  }

  async hasProfile(id) {
    if (this.remote) {
      const saved = await this.readRemoteProfiles();
      return Boolean(saved[id]);
    }
    try { return (await fs.readdir(path.join(this.root, 'profiles', id))).length > 0; }
    catch { return false; }
  }

  async readRemoteProfiles() {
    try { return JSON.parse(await fs.readFile(path.join(this.root, 'browserless-profiles.json'), 'utf8')); }
    catch { return {}; }
  }

  async markRemoteProfile(id, saved) {
    await fs.mkdir(this.root, { recursive: true });
    const data = await this.readRemoteProfiles();
    if (saved) data[id] = { name: profileName(id), savedAt: new Date().toISOString() };
    else delete data[id];
    await fs.writeFile(path.join(this.root, 'browserless-profiles.json'), JSON.stringify(data, null, 2));
  }

  definition(id) {
    const p = providers[id];
    if (!p) throw new Error(`Unsupported provider: ${id}`);
    return p;
  }

  async openLogin(id) {
    const p = this.definition(id);
    if (this.remote) {
      await this.dropSession(id);
      const context = await this.context(id, false, { forLogin: true });
      const page = await this.page(context, p.url);
      const liveURL = await this.createLiveUrl(page, context);
      return {
        id,
        url: p.url,
        liveURL,
        message: liveURL
          ? `Open the live browser link, sign in to ${p.name}, then click Verify session.`
          : `Browserless live view is unavailable on this plan. Sign in at ${p.url} is not enough — upgrade Browserless for LiveURL, or run HotPlug where Chromium can open locally.`,
      };
    }
    const context = await this.context(id, false);
    const page = await this.page(context, p.url);
    await page.bringToFront();
    const remoteAdmin = Boolean(process.env.HOTPLUG_PUBLIC_HOST) && !this.remote;
    return {
      id,
      url: p.url,
      message: remoteAdmin
        ? `Browser opened on the phone. Use VNC (hs-vnc.sh) to see it, sign in to ${p.name}, then click Verify. Or set HOTPLUG_BROWSERLESS_TOKEN for a live browser link here.`
        : `Sign in to ${p.name} in the opened Chromium window, then click Verify session.`,
    };
  }

  async dropSession(id) {
    const context = this.contexts.get(id);
    const browser = this.browsers.get(id);
    this.contexts.delete(id);
    this.browsers.delete(id);
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }

  async createLiveUrl(page, context) {
    try {
      const cdp = await context.newCDPSession(page);
      const result = await cdp.send('Browserless.liveURL', {
        timeout: 600000,
        quality: 50,
        type: 'jpeg',
        interactable: true,
        showBrowserInterface: true,
      });
      if (result?.error) throw new Error(result.error);
      return result?.liveURL || null;
    } catch (error) {
      console.error('[hotplug] Browserless.liveURL failed:', error.message);
      return null;
    }
  }

  async verify(id) {
    const p = this.definition(id);
    const context = await this.context(id, false, { forLogin: this.remote && !await this.hasProfile(id) && !this.contexts.has(id) });
    const page = await this.page(context, p.url);
    const input = await this.firstVisible(page, p.input, 15000);
    if (!input) throw new Error(`No ${p.name} chat input found. Finish signing in, dismiss any welcome screen, and try again.`);
    if (this.remote) {
      await this.saveRemoteProfile(id, page, context);
      await this.markRemoteProfile(id, true);
    }
    return { connected: true };
  }

  async saveRemoteProfile(id, page, context) {
    try {
      const cdp = await context.newCDPSession(page);
      const result = await cdp.send('Browserless.saveProfile', { name: profileName(id) });
      if (result?.error) throw new Error(result.error);
      if (result && result.ok === false) throw new Error(result.message || 'Browserless.saveProfile failed');
    } catch (error) {
      throw new Error(`Signed in, but saving Browserless profile failed: ${error.message}`);
    }
  }

  async diagnose(id, draft = '') {
    const p = this.definition(id);
    const context = await this.context(id, process.env.HOTPLUG_HEADLESS !== 'false');
    const page = await this.page(context, p.url);
    if (draft) {
      const editor = await this.firstVisible(page, p.input, 10000);
      if (editor) {
        await this.focusAndType(page, editor, draft);
        await page.waitForTimeout(700);
      }
    }
    const elements = await page.locator('textarea, [contenteditable="true"], input').evaluateAll(items => items.filter(item => {
      const box = item.getBoundingClientRect();
      const style = getComputedStyle(item);
      return box.width > 0 && box.height > 0 && style.visibility !== 'hidden';
    }).map(item => ({
      tag: item.tagName.toLowerCase(),
      id: item.id || '',
      classes: typeof item.className === 'string' ? item.className.slice(0, 180) : '',
      ariaLabel: item.getAttribute('aria-label') || '',
      placeholder: item.getAttribute('placeholder') || '',
      role: item.getAttribute('role') || '',
      contenteditable: item.getAttribute('contenteditable') || '',
    })).slice(0, 20));
    const buttons = await page.locator('button, [role="button"]').evaluateAll(items => items.filter(item => {
      const box = item.getBoundingClientRect();
      return box.width > 0 && box.height > 0;
    }).map(item => ({
      tag: item.tagName.toLowerCase(),
      ariaLabel: item.getAttribute('aria-label') || '',
      title: item.getAttribute('title') || '',
      text: (item.innerText || '').trim().slice(0, 80),
      classes: typeof item.className === 'string' ? item.className.slice(0, 160) : '',
      html: item.outerHTML.slice(0, 400),
    })).slice(-40));
    const responses = await page.locator('message-content, model-response, [class*="response"], [class*="markdown"]').evaluateAll(items => items.filter(item => {
      const box = item.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && (item.innerText || '').trim();
    }).map(item => ({
      tag: item.tagName.toLowerCase(),
      classes: typeof item.className === 'string' ? item.className.slice(0, 180) : '',
      text: (item.innerText || '').trim().slice(0, 200),
    })).slice(-20));
    return { id, url: page.url(), title: await page.title(), elements, buttons, responses };
  }

  async send(id, prompt) {
    const run = async () => {
      const p = this.definition(id);
      try {
        const context = await this.context(id, process.env.HOTPLUG_HEADLESS !== 'false');
        const page = await this.page(context, p.url);
        await this.dismissOverlays(page);
        const input = await this.firstVisible(page, p.input, 12000);
        if (!input) throw new Error(`${p.name} session is not signed in or its chat input changed.`);
        const before = await this.responseCount(page, p.response);
        await this.focusAndType(page, input, prompt);
        await this.submitPrompt(page, p);
        const answer = await this.waitForAnswer(page, p.response, before);
        if (!answer) throw new Error(`${p.name} did not return a readable response within 90 seconds. Re-verify the session in Admin if Gemini shows a login or consent screen.`);
        return answer;
      } catch (error) {
        // Stale Chromium sessions after a failed reply cause endless 90s timeouts — always recycle.
        await this.dropSession(id);
        throw error;
      }
    };
    const previous = this.queues.get(id) || Promise.resolve();
    const next = previous.catch(() => {}).then(run);
    this.queues.set(id, next);
    return next.finally(() => { if (this.queues.get(id) === next) this.queues.delete(id); });
  }

  async dismissOverlays(page) {
    const labels = ['Accept all', 'I agree', 'Got it', 'Continue', 'Dismiss', 'No thanks', 'Not now'];
    for (const label of labels) {
      const btn = page.getByRole('button', { name: label }).first();
      if (await btn.isVisible().catch(() => false)) await btn.click({ force: true }).catch(() => {});
    }
  }

  async submitPrompt(page, p) {
    // Prefer the Send button — Enter often just inserts a newline in Quill/Gemini.
    for (let attempt = 0; attempt < 3; attempt++) {
      const sendButton = await this.firstVisible(page, p.send || [], 2500);
      if (sendButton) {
        const disabled = await sendButton.isDisabled().catch(() => false);
        if (!disabled) {
          await sendButton.click({ force: true, timeout: 8000 }).catch(() => {});
          return;
        }
      }
      await page.keyboard.press(attempt === 0 ? 'Enter' : 'Control+Enter').catch(() => {});
      await page.waitForTimeout(400);
    }
  }

  async focusAndType(page, input, prompt) {
    try {
      await input.click({ force: true, timeout: 5000 });
    } catch {
      await input.evaluate(el => { el.focus(); }).catch(() => {});
    }
    try {
      await page.keyboard.press('Control+A');
      await page.keyboard.press('Backspace');
    } catch { /* ignore */ }
    try {
      await input.fill(prompt, { timeout: 4000 });
      return;
    } catch { /* fall through */ }
    const setOk = await input.evaluate((el, text) => {
      el.focus();
      if ('value' in el) {
        el.value = text;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return Boolean(el.value);
      }
      el.textContent = '';
      document.execCommand('selectAll', false);
      const ok = document.execCommand('insertText', false, text);
      el.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }));
      return ok || Boolean((el.innerText || '').trim());
    }, prompt).catch(() => false);
    if (!setOk) await page.keyboard.type(prompt, { delay: 5 });
  }

  taskType(prompt) {
    const text = prompt.toLowerCase();
    if (/code|debug|function|class|sql|api|typescript|python/.test(text)) return 'coding';
    if (/analy[sz]|reason|compare|research|explain/.test(text)) return 'analysis';
    if (/write|story|creative|poem|brand/.test(text)) return 'creative';
    return 'general';
  }

  async ranked(prompt) {
    const task = this.taskType(prompt);
    const list = (await this.list()).filter(p => p.connected);
    // Prefer Gemini on phone — Claude/ChatGPT profiles often exist but hang past Cloudflare's 100s limit.
    const quality = { gemini: 100, deepseek: 88, chatgpt: 70, claude: 65 };
    const affinity = {
      coding: { deepseek: 22, gemini: 16, claude: 10, chatgpt: 8 },
      analysis: { gemini: 20, claude: 12, chatgpt: 10, deepseek: 10 },
      creative: { gemini: 18, chatgpt: 12, claude: 10, deepseek: 8 },
      general: { gemini: 25, deepseek: 12, chatgpt: 8, claude: 6 },
    };
    return list.map(p => {
      const m = this.metrics.get(p.id) || {};
      const speed = m.averageMs ? Math.max(0, 25 - m.averageMs / 2000) : 12;
      const reliability = (m.successes || 0) * 4 - (m.failures || 0) * 20;
      return { ...p, score: quality[p.id] + affinity[task][p.id] + speed + reliability + (p.running ? 15 : 0) };
    }).sort((a, b) => b.score - a.score);
  }

  async sendForModel(prompt, model = 'auto') {
    const id = model === 'auto' ? null : model;
    if (id) {
      if (!providers[id]) throw new Error(`Unknown model "${id}".`);
      if (!await this.hasProfile(id)) throw new Error(`Provider ${providers[id].name} is not signed in. Open HotPlug Admin and sign in first.`);
      const started = Date.now();
      const content = await this.send(id, prompt);
      return { content, provider: id, latencyMs: Date.now() - started, model: id };
    }
    return this.sendAuto(prompt);
  }

  async sendAuto(prompt) {
    const candidates = await this.ranked(prompt);
    if (!candidates.length) throw new Error('No signed-in provider profiles are available. Sign in to at least one provider in HotPlug Admin.');
    // Default: one provider only. Failover multiplies cold-start time past Cloudflare 524.
    const limit = process.env.HOTPLUG_AUTO_FAILOVER === 'true' ? candidates.length : 1;
    const failures = [];
    for (const provider of candidates.slice(0, limit)) {
      const started = Date.now();
      try {
        const content = await this.send(provider.id, prompt);
        const elapsed = Date.now() - started;
        const old = this.metrics.get(provider.id) || { successes: 0, failures: 0 };
        this.metrics.set(provider.id, { ...old, successes: old.successes + 1, averageMs: old.averageMs ? Math.round(old.averageMs * .7 + elapsed * .3) : elapsed });
        return { content, provider: provider.id, latencyMs: elapsed };
      } catch (error) {
        const old = this.metrics.get(provider.id) || { successes: 0, failures: 0 };
        this.metrics.set(provider.id, { ...old, failures: old.failures + 1 });
        failures.push(`${provider.name}: ${error.message}`);
      }
    }
    throw new Error(`Auto-route failed. ${failures.join(' | ')}. Pin model to gemini in the UI if Gemini is signed in.`);
  }

  async context(id, headless, { forLogin = false } = {}) {
    if (this.contexts.has(id)) return this.contexts.get(id);
    if (this.remote) return this.remoteContext(id, { forLogin });
    const dir = path.join(this.root, 'profiles', id);
    await fs.mkdir(dir, { recursive: true });
    const browser = await this.chromium();
    const context = await browser.launchPersistentContext(dir, {
      headless,
      viewport: { width: 1400, height: 900 },
      args: ['--disable-blink-features=AutomationControlled'],
    });
    context.on('close', () => this.contexts.delete(id));
    this.contexts.set(id, context);
    return context;
  }

  async remoteContext(id, { forLogin = false } = {}) {
    const chromium = await this.chromium();
    let browser;
    try {
      browser = await chromium.connectOverCDP(this.wsEndpoint(id, { forLogin }));
    } catch (error) {
      throw new Error(`Browserless connection failed: ${error.message}. Check HOTPLUG_BROWSERLESS_TOKEN and plan limits.`);
    }
    const context = browser.contexts()[0] || await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const release = () => {
      this.contexts.delete(id);
      this.browsers.delete(id);
    };
    browser.on('disconnected', release);
    context.on('close', release);
    this.browsers.set(id, browser);
    this.contexts.set(id, context);
    return context;
  }

  async page(context, url) {
    let page = context.pages().find(p => p.url().startsWith(new URL(url).origin));
    if (!page) page = context.pages()[0] || await context.newPage();
    if (!page.url().startsWith(new URL(url).origin)) await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    return page;
  }

  async firstVisible(page, selectors, timeout) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      for (const selector of selectors) {
        const item = page.locator(selector).last();
        if (await item.isVisible().catch(() => false)) return item;
      }
      await page.waitForTimeout(400);
    }
    return null;
  }

  async responseCount(page, selectors) {
    let count = 0;
    for (const selector of selectors) count = Math.max(count, await page.locator(selector).count());
    return count;
  }

  async waitForAnswer(page, selectors, before) {
    const end = Date.now() + 90000;
    let last = '', stable = 0;
    while (Date.now() < end) {
      for (const selector of selectors) {
        const items = page.locator(selector);
        const count = await items.count();
        if (count > before) {
          const text = (await items.last().innerText().catch(() => '')).trim();
          if (text && text === last) stable++;
          else { last = text; stable = 0; }
          if (last && stable >= 3) return last;
        }
      }
      await page.waitForTimeout(600);
    }
    return last || null;
  }

  async close() {
    await Promise.all([...this.contexts.values()].map(c => c.close().catch(() => {})));
    await Promise.all([...this.browsers.values()].map(b => b.close().catch(() => {})));
  }
}
