/** OpenAI-shaped tool calling over free browser chat — code fills the function-calling gap. */

import { buildPrompt } from '../messages.js';
import { parseToolCalls, stripToolCallBlocks, toolCatalogPrompt } from './parse.js';

const REPAIR_PROMPT = `Your previous reply was INVALID for tool calling.

Reply with EXACTLY one of:
1) One or more tool calls and NOTHING else:
TOOL_CALL
{"name":"TOOL_NAME","arguments":{...}}
END_TOOL_CALL

2) Or a final user-facing answer with NO TOOL_CALL blocks.

Do not explain. Do not use markdown fences unless inside arguments strings.`;

export function openaiToolsToDefs(tools = []) {
  return tools.map(t => {
    const fn = t.function || t;
    return {
      name: fn.name,
      description: fn.description || '',
      parameters: fn.parameters || { type: 'object', properties: {} },
    };
  }).filter(t => t.name);
}

export function validateToolCall(call, allowedNames) {
  const name = call?.function?.name;
  if (!name || !allowedNames.has(name)) return null;
  let args = {};
  try { args = JSON.parse(call.function.arguments || '{}'); }
  catch { return null; }
  if (args === null || typeof args !== 'object' || Array.isArray(args)) return null;
  return {
    id: call.id || `call_${Math.random().toString(36).slice(2, 10)}`,
    type: 'function',
    function: { name, arguments: JSON.stringify(args) },
  };
}

export function filterValidCalls(calls, toolDefs) {
  const allowed = new Set(toolDefs.map(t => t.name));
  return (calls || []).map(c => validateToolCall(c, allowed)).filter(Boolean);
}

/** Last-resort: code guesses a tool from natural language when the brain forgets the format. */
export function intentFallback(text, toolDefs) {
  const t = String(text || '').toLowerCase();
  const has = name => toolDefs.some(x => x.name === name);
  const calls = [];

  const search = t.match(/(?:search(?:\s+the\s+web)?(?:\s+for)?|google|look up)\s+["']?([^"'\n.]+)["']?/i)
    || t.match(/(?:find information (?:about|on))\s+(.+)$/i);
  if (search && has('web_search')) {
    calls.push({ id: `call_fb_search`, type: 'function', function: { name: 'web_search', arguments: JSON.stringify({ query: search[1].trim().slice(0, 200) }) } });
  }

  const cmd = t.match(/(?:run|execute)\s+(?:the\s+)?(?:command|shell|terminal)\s*[:`]?\s*[`']?([^`'\n]+)[`']?/i)
    || t.match(/(?:run|execute)\s+command\s*[:`]?\s*[`']?([^`'\n]+)[`']?/i)
    || t.match(/(?:^|\n)\s*(?:\$|>)\s*((?:ls|pwd|git|npm|node|python|pip|dir)\b[^\n]*)/i);
  if (cmd && has('run_terminal')) {
    calls.push({ id: `call_fb_term`, type: 'function', function: { name: 'run_terminal', arguments: JSON.stringify({ command: cmd[1].trim().slice(0, 500) }) } });
  }

  const read = t.match(/(?:read|open|show)\s+(?:file\s+)?["'`]?([^\s"'`]+\.[a-z0-9]+)["'`]?/i);
  if (read && has('read_file')) {
    calls.push({ id: `call_fb_read`, type: 'function', function: { name: 'read_file', arguments: JSON.stringify({ path: read[1] }) } });
  }

  const nav = t.match(/(?:open|visit|navigate(?:\s+to)?)\s+(https?:\/\/\S+)/i);
  if (nav && has('browser_navigate')) {
    calls.push({ id: `call_fb_nav`, type: 'function', function: { name: 'browser_navigate', arguments: JSON.stringify({ url: nav[1].replace(/[),.;]+$/, '') }) } });
  }

  return filterValidCalls(calls, toolDefs);
}

function looksLikeFinalAnswer(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  if (/TOOL_CALL|tool_calls|"name"\s*:\s*"/i.test(t) && t.length < 80) return false;
  // Short actionable intents should not be treated as finals
  if (/^(i('ll| will)|let me|i need to|search|run|open)\b/i.test(t) && t.length < 160) return false;
  return t.length > 20 || /[.!?]$/.test(t);
}

/**
 * One brain turn → either OpenAI tool_calls or final content.
 * Retries with a repair prompt when format is wrong (code enforces the protocol).
 */
export async function bridgeToolTurn({
  sessions,
  model = 'auto',
  messages = [],
  toolDefs = [],
  allowIntentFallback = true,
  maxRepairs = 2,
}) {
  if (!toolDefs.length) throw new Error('No tools provided for tool-calling bridge');

  const history = [
    { role: 'system', content: toolCatalogPrompt(toolDefs) },
    ...messages.filter(m => m.role !== 'system'),
  ];

  let provider = model;
  let latencyMs = 0;
  let lastRaw = '';

  for (let attempt = 0; attempt <= maxRepairs; attempt++) {
    const prompt = buildPrompt(history);
    const routed = await sessions.sendForModel(prompt, model === 'auto' ? 'auto' : model);
    provider = routed.provider;
    latencyMs += routed.latencyMs || 0;
    lastRaw = routed.content || '';

    let calls = filterValidCalls(parseToolCalls(lastRaw), toolDefs);
    if (!calls.length && allowIntentFallback) {
      calls = intentFallback(lastRaw, toolDefs);
    }

    if (calls.length) {
      return {
        finish_reason: 'tool_calls',
        tool_calls: calls,
        content: null,
        provider,
        latencyMs,
        raw: lastRaw,
        repairs: attempt,
      };
    }

    const finalText = stripToolCallBlocks(lastRaw) || lastRaw;
    if (looksLikeFinalAnswer(finalText) && attempt >= 1) {
      return {
        finish_reason: 'stop',
        tool_calls: null,
        content: finalText,
        provider,
        latencyMs,
        raw: lastRaw,
        repairs: attempt,
      };
    }

    // Repair: ask again with strict format
    history.push({ role: 'assistant', content: lastRaw });
    history.push({ role: 'user', content: REPAIR_PROMPT });
  }

  // Exhausted repairs — if intent fallback can still help, use it; else return text
  const fallback = allowIntentFallback ? intentFallback(lastRaw, toolDefs) : [];
  if (fallback.length) {
    return {
      finish_reason: 'tool_calls',
      tool_calls: fallback,
      content: null,
      provider,
      latencyMs,
      raw: lastRaw,
      repairs: maxRepairs,
    };
  }

  return {
    finish_reason: 'stop',
    tool_calls: null,
    content: stripToolCallBlocks(lastRaw) || lastRaw || 'No response.',
    provider,
    latencyMs,
    raw: lastRaw,
    repairs: maxRepairs,
  };
}
