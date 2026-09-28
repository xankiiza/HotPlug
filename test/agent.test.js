import test from 'node:test';
import assert from 'node:assert/strict';
import { parseToolCalls, stripToolCallBlocks, toolCatalogPrompt } from '../server/agent/parse.js';
import { createToolRegistry } from '../server/agent/tools.js';
import { resolveModel, responseModel } from '../server/models.js';

test('resolveModel distinguishes chat vs agent', () => {
  assert.deepEqual(resolveModel('auto'), { mode: 'chat', brain: 'auto' });
  assert.deepEqual(resolveModel('gemini'), { mode: 'chat', brain: 'gemini' });
  assert.deepEqual(resolveModel('agent'), { mode: 'agent', brain: 'auto' });
  assert.deepEqual(resolveModel('hotplug/agent/gemini'), { mode: 'agent', brain: 'gemini' });
  assert.equal(responseModel('agent/gemini'), 'agent/gemini');
});

test('parseToolCalls reads TOOL_CALL blocks', () => {
  const text = `Thinking...
TOOL_CALL
{"name":"web_search","arguments":{"query":"hotplug"}}
END_TOOL_CALL
`;
  const calls = parseToolCalls(text);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].function.name, 'web_search');
  assert.match(calls[0].function.arguments, /hotplug/);
});

test('stripToolCallBlocks leaves final prose', () => {
  const text = `TOOL_CALL\n{"name":"list_dir","arguments":{}}\nEND_TOOL_CALL\nDone.`;
  assert.equal(stripToolCallBlocks(text), 'Done.');
});

test('tool registry lists core tools', () => {
  const tools = createToolRegistry().list();
  assert.ok(tools.some(t => t.name === 'run_terminal'));
  assert.ok(tools.some(t => t.name === 'web_search'));
  assert.ok(tools.some(t => t.name === 'browser_navigate'));
  assert.match(toolCatalogPrompt(tools), /TOOL_CALL/);
});

test('write_file and read_file roundtrip in workspace', async () => {
  const registry = createToolRegistry();
  const name = `agent-test-${Date.now()}.txt`;
  await registry.execute('write_file', { path: name, content: 'hello-agent' });
  const read = await registry.execute('read_file', { path: name });
  assert.equal(read.content, 'hello-agent');
});
