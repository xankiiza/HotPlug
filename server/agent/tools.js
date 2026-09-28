import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const workspaceRoot = () => path.resolve(process.env.HOTPLUG_WORKSPACE || path.join(process.env.HOTPLUG_DATA_DIR || path.resolve('data'), 'workspace'));

async function ensureWorkspace() {
  const root = workspaceRoot();
  await fs.mkdir(root, { recursive: true });
  return root;
}

function safeJoin(root, rel = '.') {
  const resolved = path.resolve(root, rel || '.');
  if (!resolved.startsWith(root)) throw new Error('Path escapes workspace');
  return resolved;
}

async function runTerminal({ command, timeoutMs = 30000 }) {
  if (!command || typeof command !== 'string') throw new Error('command is required');
  const root = await ensureWorkspace();
  return new Promise(resolve => {
    const child = spawn(process.platform === 'win32' ? 'cmd.exe' : 'bash', process.platform === 'win32' ? ['/c', command] : ['-lc', command], {
      cwd: root,
      env: { ...process.env, PATH: process.env.PATH },
      windowsHide: true,
    });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); resolve({ ok: false, error: `timeout after ${timeoutMs}ms`, stdout, stderr }); }, timeoutMs);
    child.stdout.on('data', d => { stdout += d; if (stdout.length > 40000) stdout = stdout.slice(-40000); });
    child.stderr.on('data', d => { stderr += d; if (stderr.length > 20000) stderr = stderr.slice(-20000); });
    child.on('close', code => { clearTimeout(timer); resolve({ ok: code === 0, exitCode: code, stdout: stdout.trim(), stderr: stderr.trim() }); });
    child.on('error', error => { clearTimeout(timer); resolve({ ok: false, error: error.message, stdout, stderr }); });
  });
}

async function readFile({ path: rel }) {
  const root = await ensureWorkspace();
  const full = safeJoin(root, rel);
  const content = await fs.readFile(full, 'utf8');
  return { path: rel, content: content.slice(0, 80000) };
}

async function writeFile({ path: rel, content }) {
  const root = await ensureWorkspace();
  const full = safeJoin(root, rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, String(content ?? ''), 'utf8');
  return { path: rel, bytes: Buffer.byteLength(String(content ?? ''), 'utf8') };
}

async function listDir({ path: rel = '.' }) {
  const root = await ensureWorkspace();
  const full = safeJoin(root, rel);
  const entries = await fs.readdir(full, { withFileTypes: true });
  return {
    path: rel,
    entries: entries.slice(0, 200).map(e => ({ name: e.name, type: e.isDirectory() ? 'dir' : 'file' })),
  };
}

async function webSearch({ query, limit = 5 }) {
  if (!query) throw new Error('query is required');
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HotPlugAgent/0.3)' },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`search failed: HTTP ${res.status}`);
  const html = await res.text();
  const results = [];
  const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) && results.length < Math.min(Number(limit) || 5, 10)) {
    const title = m[2].replace(/<[^>]+>/g, '').trim();
    let href = m[1];
    try {
      const u = new URL(href, 'https://duckduckgo.com');
      if (u.searchParams.get('uddg')) href = decodeURIComponent(u.searchParams.get('uddg'));
    } catch { /* keep */ }
    results.push({ title, url: href });
  }
  return { query, results };
}

async function browserNavigate({ url, extract = 'text' }, browserTool) {
  if (!browserTool) throw new Error('browser tool unavailable');
  return browserTool.navigate({ url, extract });
}

export function createToolRegistry({ browserTool = null } = {}) {
  const defs = [
    {
      name: 'run_terminal',
      description: 'Run a shell command in the HotPlug workspace directory. Use for builds, git, scripts.',
      parameters: { type: 'object', properties: { command: { type: 'string' }, timeoutMs: { type: 'number' } }, required: ['command'] },
      run: runTerminal,
    },
    {
      name: 'read_file',
      description: 'Read a text file from the HotPlug workspace.',
      parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
      run: readFile,
    },
    {
      name: 'write_file',
      description: 'Write a text file in the HotPlug workspace (creates parent dirs).',
      parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] },
      run: writeFile,
    },
    {
      name: 'list_dir',
      description: 'List files and folders in the HotPlug workspace.',
      parameters: { type: 'object', properties: { path: { type: 'string' } } },
      run: listDir,
    },
    {
      name: 'web_search',
      description: 'Search the web (DuckDuckGo) and return top result titles/URLs.',
      parameters: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'number' } }, required: ['query'] },
      run: webSearch,
    },
    {
      name: 'browser_navigate',
      description: 'Open a URL in HotPlug’s agent browser and extract page text or title.',
      parameters: { type: 'object', properties: { url: { type: 'string' }, extract: { type: 'string', enum: ['text', 'title'] } }, required: ['url'] },
      run: args => browserNavigate(args, browserTool),
    },
  ];

  return {
    list: () => defs.map(({ name, description, parameters }) => ({ name, description, parameters })),
    async execute(name, args) {
      const tool = defs.find(t => t.name === name);
      if (!tool) throw new Error(`Unknown tool: ${name}`);
      return tool.run(typeof args === 'string' ? JSON.parse(args || '{}') : (args || {}));
    },
    workspaceRoot,
  };
}
