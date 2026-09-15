import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server/app.js';
import { Store } from '../server/store.js';

const mockSessions = {
  list: async () => [{ id: 'gemini', name: 'Gemini', model: 'gemini-2.5-flash', connected: true, running: false }],
  sendAuto: async () => ({ content: 'Hello from HotPlug.', provider: 'gemini', latencyMs: 1200 }),
  sendForModel: async (prompt, model) => {
    if (model === 'auto') return mockSessions.sendAuto(prompt);
    if (model === 'gemini') return { content: 'Hello from Gemini.', provider: 'gemini', latencyMs: 900, model: 'gemini' };
    throw new Error(`Provider ${model} is not signed in. Open HotPlug Admin and sign in first.`);
  },
};

async function withServer(run) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'hotplug-api-'));
  const store = new Store(root);
  const key = await store.createKey('test');
  const app = createApp({ sessions: mockSessions, store });
  const server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`, key.token);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('GET /v1/models returns auto and provider models', async () => {
  await withServer(async (base, token) => {
    const res = await fetch(`${base}/v1/models`, { headers: { Authorization: `Bearer ${token}` } });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.object, 'list');
    assert.ok(body.data.some(m => m.id === 'auto'));
    assert.ok(body.data.some(m => m.id === 'gemini'));
    assert.ok(body.data.some(m => m.root === 'hotplug/gemini'));
  });
});

test('POST /v1/chat/completions returns OpenAI-compatible shape', async () => {
  await withServer(async (base, token) => {
    const res = await fetch(`${base}/v1/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'auto', messages: [{ role: 'user', content: 'Hi' }] }),
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.match(body.id, /^chatcmpl-/);
    assert.equal(body.object, 'chat.completion');
    assert.equal(typeof body.created, 'number');
    assert.equal(body.model, 'auto');
    assert.equal(body.system_fingerprint, 'hotplug-gemini');
    assert.equal(body.choices[0].message.role, 'assistant');
    assert.equal(body.choices[0].message.content, 'Hello from HotPlug.');
    assert.equal(body.choices[0].finish_reason, 'stop');
    assert.equal(typeof body.usage.prompt_tokens, 'number');
    assert.equal(typeof body.usage.completion_tokens, 'number');
    assert.equal(body.usage.total_tokens, body.usage.prompt_tokens + body.usage.completion_tokens);
    assert.equal(res.headers.get('x-hotplug-provider'), 'gemini');
  });
});

test('POST /v1/chat/completions honors specific provider model', async () => {
  await withServer(async (base, token) => {
    const res = await fetch(`${base}/v1/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gemini', messages: [{ role: 'user', content: 'Hi' }] }),
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.model, 'gemini');
    assert.equal(body.choices[0].message.content, 'Hello from Gemini.');
  });
});

test('POST /v1/chat/completions accepts hotplug/ prefix from OpenClaw', async () => {
  await withServer(async (base, token) => {
    const res = await fetch(`${base}/v1/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'hotplug/auto', messages: [{ role: 'user', content: 'Hi' }] }),
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.model, 'auto');
  });
});

test('POST /v1/chat/completions rejects unknown model', async () => {
  await withServer(async (base, token) => {
    const res = await fetch(`${base}/v1/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: 'Hi' }] }),
    });
    const body = await res.json();
    assert.equal(res.status, 400);
    assert.equal(body.error.type, 'invalid_request_error');
    assert.match(body.error.message, /Unknown model/);
  });
});

test('POST /v1/chat/completions streams OpenAI-compatible SSE chunks', async () => {
  await withServer(async (base, token) => {
    const res = await fetch(`${base}/v1/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'auto', messages: [{ role: 'user', content: 'Hi' }], stream: true }),
    });
    const text = await res.text();
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/event-stream/);
    const events = text.split('\n\n').filter(Boolean).map(line => line.replace(/^data: /, ''));
    assert.equal(events.at(-1), '[DONE]');
    const first = JSON.parse(events[0]);
    const content = JSON.parse(events[1]);
    const finish = JSON.parse(events[2]);
    assert.equal(first.object, 'chat.completion.chunk');
    assert.equal(first.choices[0].delta.role, 'assistant');
    assert.equal(first.choices[0].delta.content, undefined);
    assert.equal(content.choices[0].delta.content, 'Hello from HotPlug.');
    assert.equal(finish.choices[0].finish_reason, 'stop');
    assert.equal(typeof finish.usage.total_tokens, 'number');
  });
});
