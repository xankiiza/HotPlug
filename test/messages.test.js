import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPrompt, messageText } from '../server/messages.js';

test('buildPrompt keeps latest user message when history is huge', () => {
  const messages = [{ role: 'system', content: 'You are Max.' }];
  for (let i = 0; i < 200; i++) messages.push({ role: 'user', content: `old message ${i} `.repeat(40) });
  messages.push({ role: 'user', content: 'What is 2+2?' });
  const prompt = buildPrompt(messages);
  assert.match(prompt, /2\+2/);
  assert.ok(prompt.length <= 12000);
});

test('buildPrompt summarizes tool and assistant tool_calls', () => {
  const prompt = buildPrompt([
    { role: 'user', content: 'run ping' },
    { role: 'assistant', content: '', tool_calls: [{ id: '1', type: 'function', function: { name: 'exec', arguments: '{}' } }] },
    { role: 'tool', content: 'pong' },
    { role: 'user', content: 'thanks' },
  ]);
  assert.match(prompt, /called 1 tool/);
  assert.match(prompt, /Tool: pong/);
  assert.match(prompt, /thanks/);
});

test('messageText handles text parts array', () => {
  assert.equal(messageText([{ type: 'text', text: 'hello' }, { type: 'image_url', image_url: { url: 'x' } }]), 'hello\n[image omitted]');
});
