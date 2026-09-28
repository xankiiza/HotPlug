/** Parse tool calls from free-web-UI model text (no native function calling). */

const BLOCK = /TOOL_CALL\s*([\s\S]*?)\s*END_TOOL_CALL/gi;
const FENCE = /```(?:json)?\s*([\s\S]*?)```/gi;

export function toolCatalogPrompt(tools) {
  const lines = tools.map(t => `- ${t.name}: ${t.description}\n  args: ${JSON.stringify(t.parameters)}`).join('\n');
  return `You are HotPlug Agent. You can use tools to act in the real world.

Available tools:
${lines}

Rules:
1. If you need a tool, reply with ONLY this block (no other text):
TOOL_CALL
{"name":"tool_name","arguments":{...}}
END_TOOL_CALL
2. You may emit multiple TOOL_CALL blocks if needed.
3. When you have enough information, reply with a normal final answer (no TOOL_CALL blocks).
4. Prefer tools for coding, shell, browsing, and search instead of guessing.`;
}

export function parseToolCalls(text) {
  const calls = [];
  const seen = new Set();
  const push = obj => {
    if (!obj || typeof obj !== 'object') return;
    const name = obj.name || obj.tool || obj.function?.name;
    if (!name) return;
    let args = obj.arguments ?? obj.args ?? obj.parameters ?? obj.function?.arguments ?? {};
    if (typeof args === 'string') {
      try { args = JSON.parse(args); } catch { /* keep string */ }
    }
    const key = `${name}:${typeof args === 'string' ? args : JSON.stringify(args)}`;
    if (seen.has(key)) return;
    seen.add(key);
    calls.push({
      id: `call_${cryptoRandom()}`,
      type: 'function',
      function: { name: String(name), arguments: typeof args === 'string' ? args : JSON.stringify(args ?? {}) },
    });
  };

  let match;
  const re = new RegExp(BLOCK);
  while ((match = re.exec(text))) {
    try { push(JSON.parse(match[1].trim())); } catch { /* ignore */ }
  }
  if (calls.length) return calls;

  // XML-ish free models: <tool_call>...</tool_call> or invoke tool_name
  const xml = /<(?:tool_call|function_call|tool)\b[^>]*>([\s\S]*?)<\/(?:tool_call|function_call|tool)>/gi;
  while ((match = xml.exec(text))) {
    const inner = match[1].trim();
    try { push(JSON.parse(inner)); }
    catch {
      const n = inner.match(/name["'\s:=]+([a-zA-Z0-9_.-]+)/i);
      const a = inner.match(/arguments["'\s:=]+(\{[\s\S]*\})/i);
      if (n) {
        try { push({ name: n[1], arguments: a ? JSON.parse(a[1]) : {} }); } catch { push({ name: n[1], arguments: {} }); }
      }
    }
  }
  if (calls.length) return calls;

  const fence = new RegExp(FENCE);
  while ((match = fence.exec(text))) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (Array.isArray(parsed.tool_calls)) {
        for (const c of parsed.tool_calls) push({ name: c.name || c.function?.name, arguments: c.arguments || c.function?.arguments });
      } else if (Array.isArray(parsed)) {
        for (const c of parsed) push(c);
      } else if (parsed.name || parsed.function) push(parsed);
    } catch { /* ignore */ }
  }
  if (calls.length) return calls;

  // Bare JSON object(s) in prose (one level of nested braces for arguments)
  const jsonObj = /\{(?:[^{}]|\{[^{}]*\})*"name"\s*:\s*"[^"]+"(?:[^{}]|\{[^{}]*\})*\}/g;
  while ((match = jsonObj.exec(text))) {
    try { push(JSON.parse(match[0])); } catch { /* ignore */ }
  }
  if (calls.length) return calls;

  const trimmed = text.trim();
  if (trimmed.startsWith('{') && /"name"\s*:/.test(trimmed)) {
    try { push(JSON.parse(trimmed)); } catch { /* ignore */ }
  }
  return calls;
}

export function stripToolCallBlocks(text) {
  return String(text || '')
    .replace(BLOCK, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cryptoRandom() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
