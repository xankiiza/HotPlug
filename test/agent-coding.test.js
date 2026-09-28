import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runAgentLoop } from '../server/agent/loop.js';
import { createApp } from '../server/app.js';
import { Store } from '../server/store.js';

/**
 * Scripted brain that performs a mini agentic coding task:
 * write a JS file → run it with node → read the output file → final answer.
 */
function codingBrain(workspaceFile) {
  const scriptName = path.basename(workspaceFile);
  const outName = scriptName.replace(/\.js$/, '.out.txt');
  let step = 0;
  return {
    async sendForModel() {
      step += 1;
      if (step === 1) {
        return {
          provider: 'scripted',
          latencyMs: 1,
          content: `TOOL_CALL
{"name":"write_file","arguments":{"path":"${scriptName}","content":"const fs=require('fs');\\nfs.writeFileSync('${outName}','agent-ok-'+ (2+2));\\nconsole.log('wrote');"}}
END_TOOL_CALL`,
        };
      }
      if (step === 2) {
        return {
          provider: 'scripted',
          latencyMs: 1,
          content: `TOOL_CALL
{"name":"run_terminal","arguments":{"command":"node ${scriptName}"}}
END_TOOL_CALL`,
        };
      }
      if (step === 3) {
        return {
          provider: 'scripted',
          latencyMs: 1,
          content: `TOOL_CALL
{"name":"read_file","arguments":{"path":"${outName}"}}
END_TOOL_CALL`,
        };
      }
      return {
        provider: 'scripted',
        latencyMs: 1,
        content: 'Coding task complete: node wrote agent-ok-4.',
      };
    },
  };
}

test('agent loop executes write_file + run_terminal coding task', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'hotplug-agent-code-'));
  const prevData = process.env.HOTPLUG_DATA_DIR;
  const prevWs = process.env.HOTPLUG_WORKSPACE;
  process.env.HOTPLUG_DATA_DIR = root;
  process.env.HOTPLUG_WORKSPACE = path.join(root, 'workspace');

  const stamp = Date.now();
  const scriptName = `agent-sum-${stamp}.js`;
  const outName = `agent-sum-${stamp}.out.txt`;
  const events = [];

  try {
    const result = await runAgentLoop({
      sessions: codingBrain(scriptName),
      model: 'auto',
      messages: [{ role: 'user', content: 'Write a node script that writes agent-ok-4 to a file, run it, and confirm.' }],
      onEvent: e => events.push(e),
      maxSteps: 6,
    });

    assert.equal(result.finish_reason, 'stop');
    assert.match(result.content, /agent-ok-4|complete/i);
    assert.ok(result.steps >= 3);
    assert.ok(events.some(e => e.type === 'tool_start' && e.name === 'write_file'));
    assert.ok(events.some(e => e.type === 'tool_start' && e.name === 'run_terminal'));
    assert.ok(events.some(e => e.type === 'tool_start' && e.name === 'read_file'));

    const outPath = path.join(root, 'workspace', outName);
    const out = await fs.readFile(outPath, 'utf8');
    assert.equal(out, 'agent-ok-4');

    const term = result.trace.find(t => t.name === 'run_terminal');
    assert.ok(term);
    assert.match(term.result, /"ok":\s*true|"exitCode":\s*0|wrote/);
  } finally {
    if (prevData === undefined) delete process.env.HOTPLUG_DATA_DIR;
    else process.env.HOTPLUG_DATA_DIR = prevData;
    if (prevWs === undefined) delete process.env.HOTPLUG_WORKSPACE;
    else process.env.HOTPLUG_WORKSPACE = prevWs;
  }
});

test('agent API executes terminal coding via /v1 (model=agent)', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'hotplug-agent-api-'));
  const prevData = process.env.HOTPLUG_DATA_DIR;
  const prevWs = process.env.HOTPLUG_WORKSPACE;
  process.env.HOTPLUG_DATA_DIR = root;
  process.env.HOTPLUG_WORKSPACE = path.join(root, 'workspace');

  const stamp = Date.now();
  const scriptName = `api-echo-${stamp}.js`;
  const outName = `api-echo-${stamp}.out.txt`;
  const store = new Store(root);
  const key = await store.createKey('agent-code');
  const sessions = codingBrain(scriptName);
  const app = createApp({ sessions, store });
  const server = app.listen(0);
  await new Promise(r => server.once('listening', r));
  const { port } = server.address();

  try {
    const res = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'agent',
        stream: false,
        messages: [{ role: 'user', content: 'Create and run a node script that writes agent-ok-4.' }],
      }),
    });
    const body = await res.json();
    assert.equal(res.status, 200, JSON.stringify(body));
    assert.equal(body.choices[0].finish_reason, 'stop');
    assert.match(body.choices[0].message.content, /agent-ok-4|complete/i);
    assert.equal(res.headers.get('x-hotplug-provider'), 'scripted');

    const out = await fs.readFile(path.join(root, 'workspace', outName), 'utf8');
    assert.equal(out, 'agent-ok-4');
  } finally {
    await new Promise(r => server.close(r));
    if (prevData === undefined) delete process.env.HOTPLUG_DATA_DIR;
    else process.env.HOTPLUG_DATA_DIR = prevData;
    if (prevWs === undefined) delete process.env.HOTPLUG_WORKSPACE;
    else process.env.HOTPLUG_WORKSPACE = prevWs;
  }
});
