/**
 * Live agentic coding smoke: Gemini (or auto) brain + real write_file / run_terminal.
 * Usage: node scripts/live-agent-coding.js
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { ProviderSessionManager } from '../server/provider-sessions.js';
import { runAgentLoop } from '../server/agent/loop.js';

const stamp = Date.now();
const scriptName = `live-agent-${stamp}.js`;
const outName = `live-agent-${stamp}.out.txt`;
const workspace = path.resolve('data/workspace');

const sessions = new ProviderSessionManager(path.resolve('data'));
const events = [];

console.log('[live] starting agent coding task…');
console.log(`[live] target files: ${scriptName} → ${outName}`);

const result = await runAgentLoop({
  sessions,
  model: 'gemini',
  messages: [{
    role: 'user',
    content: `You are doing a short coding task in the HotPlug workspace.

1. Use write_file to create ${scriptName} with this exact Node.js program:
   const fs = require('fs');
   fs.writeFileSync('${outName}', 'live-agent-ok');
   console.log('done');

2. Use run_terminal with command: node ${scriptName}

3. Use read_file on ${outName} to confirm contents.

4. Then reply with a short final sentence including the phrase live-agent-ok.

Do not skip tools. Prefer TOOL_CALL blocks.`,
  }],
  onEvent: e => {
    events.push(e);
    if (e.type === 'tool_start') console.log(`[tool] → ${e.name}`, JSON.stringify(e.arguments || {}).slice(0, 120));
    if (e.type === 'tool_end') console.log(`[tool] ← ${e.name}`, String(e.result || '').slice(0, 160).replace(/\s+/g, ' '));
    if (e.type === 'think') console.log(`[think] step ${e.step}`);
  },
  maxSteps: 8,
});

console.log('[live] finish_reason:', result.finish_reason);
console.log('[live] steps:', result.steps);
console.log('[live] provider:', result.provider);
console.log('[live] content:', (result.content || '').slice(0, 400));
console.log('[live] trace tools:', (result.trace || []).map(t => t.name).join(' → '));

let out = null;
try {
  out = await fs.readFile(path.join(workspace, outName), 'utf8');
} catch (e) {
  out = `MISSING: ${e.message}`;
}
console.log('[live] output file:', out);

const ok = out === 'live-agent-ok'
  && (result.trace || []).some(t => t.name === 'write_file')
  && (result.trace || []).some(t => t.name === 'run_terminal');

console.log(ok ? '[live] PASS' : '[live] FAIL');
process.exit(ok ? 0 : 1);
