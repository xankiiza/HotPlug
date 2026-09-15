const MAX_PROMPT = 12000;

export function messageText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return content == null ? '' : String(content);
  return content.map(part => {
    if (!part || typeof part !== 'object') return '';
    if (part.type === 'text') return part.text || '';
    if (part.type === 'input_text') return part.text || '';
    if (part.type === 'image_url' || part.type === 'image') return '[image omitted]';
    return part.text || '';
  }).filter(Boolean).join('\n');
}

/** Flatten OpenAI/OpenClaw messages into one browser prompt. */
export function buildPrompt(messages) {
  if (!Array.isArray(messages) || !messages.length) return '';
  const parts = [];
  for (const m of messages) {
    const text = messageText(m.content).trim();
    if (m.role === 'tool' || m.role === 'function') {
      if (text) parts.push(`Tool: ${text.slice(0, 800)}`);
      continue;
    }
    if (m.role === 'assistant' && !text && m.tool_calls?.length) {
      parts.push(`Assistant: [called ${m.tool_calls.length} tool(s)]`);
      continue;
    }
    if (!text) continue;
    const label = m.role === 'system' ? 'System' : m.role === 'assistant' ? 'Assistant' : 'User';
    parts.push(`${label}: ${text}`);
  }
  let prompt = parts.join('\n\n').trim();
  if (prompt.length > MAX_PROMPT) {
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    const tail = parts.slice(-8).join('\n\n');
    prompt = tail.length <= MAX_PROMPT ? tail : `User: ${messageText(lastUser?.content).trim()}`.slice(-MAX_PROMPT);
  }
  return prompt.trim() || 'Hello';
}
