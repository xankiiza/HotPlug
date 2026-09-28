import test from 'node:test';
import assert from 'node:assert/strict';
import { filterValidCalls, intentFallback, openaiToolsToDefs, validateToolCall } from '../server/agent/bridge.js';
import { parseToolCalls } from '../server/agent/parse.js';

const defs = [
  { name: 'web_search', description: 'search', parameters: { type: 'object', properties: { query: { type: 'string' } } } },
  { name: 'run_terminal', description: 'shell', parameters: { type: 'object', properties: { command: { type: 'string' } } } },
  { name: 'read_file', description: 'read', parameters: { type: 'object', properties: { path: { type: 'string' } } } },
];

test('openaiToolsToDefs maps OpenAI tools schema', () => {
  const mapped = openaiToolsToDefs([
    { type: 'function', function: { name: 'exec', description: 'run', parameters: { type: 'object' } } },
  ]);
  assert.equal(mapped[0].name, 'exec');
});

test('filterValidCalls drops unknown tools and bad JSON', () => {
  const parsed = parseToolCalls(`TOOL_CALL\n{"name":"web_search","arguments":{"query":"x"}}\nEND_TOOL_CALL\nTOOL_CALL\n{"name":"hack","arguments":{}}\nEND_TOOL_CALL`);
  const valid = filterValidCalls(parsed, defs);
  assert.equal(valid.length, 1);
  assert.equal(valid[0].function.name, 'web_search');
});

test('intentFallback extracts search and shell intents', () => {
  const search = intentFallback('I should search for hotplug agent tools', defs);
  assert.ok(search.some(c => c.function.name === 'web_search'));
  const term = intentFallback('run command: ls -la', defs);
  assert.ok(term.some(c => c.function.name === 'run_terminal'));
  const noFalseNode = intentFallback('Coding task complete: node wrote agent-ok-4.', defs);
  assert.equal(noFalseNode.length, 0);
});

test('validateToolCall rejects invalid argument JSON', () => {
  const bad = validateToolCall({ function: { name: 'web_search', arguments: 'not-json' } }, new Set(['web_search']));
  assert.equal(bad, null);
});

test('parseToolCalls accepts xml and bare json shapes', () => {
  const xml = parseToolCalls(`<tool_call>{"name":"web_search","arguments":{"query":"x"}}</tool_call>`);
  assert.equal(xml[0].function.name, 'web_search');
  const bare = parseToolCalls(`Sure. {"name":"run_terminal","arguments":{"command":"ls"}}`);
  assert.equal(bare[0].function.name, 'run_terminal');
});

test('bridgeToolTurn returns OpenAI tool_calls after repair', async () => {
  const { bridgeToolTurn } = await import('../server/agent/bridge.js');
  let n = 0;
  const sessions = {
    sendForModel: async () => {
      n += 1;
      if (n === 1) return { content: 'I will search for that.', provider: 'gemini', latencyMs: 10 };
      return {
        content: 'TOOL_CALL\n{"name":"web_search","arguments":{"query":"hotplug"}}\nEND_TOOL_CALL',
        provider: 'gemini',
        latencyMs: 12,
      };
    },
  };
  const turn = await bridgeToolTurn({
    sessions,
    model: 'gemini',
    messages: [{ role: 'user', content: 'search for hotplug' }],
    toolDefs: defs,
    allowIntentFallback: false,
    maxRepairs: 2,
  });
  assert.equal(turn.finish_reason, 'tool_calls');
  assert.equal(turn.tool_calls[0].function.name, 'web_search');
  assert.ok(turn.repairs >= 1);
});
