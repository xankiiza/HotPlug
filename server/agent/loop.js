import { buildPrompt } from '../messages.js';
import { parseToolCalls, stripToolCallBlocks, toolCatalogPrompt } from './parse.js';
import { createToolRegistry } from './tools.js';
import { bridgeToolTurn, openaiToolsToDefs, filterValidCalls } from './bridge.js';

const MAX_STEPS = Number(process.env.HOTPLUG_AGENT_MAX_STEPS || 8);

/**
 * Local execute loop (HotPlug owns tools).
 * Uses the same bridge/repair protocol as API tool_calls mode.
 */
export async function runAgentLoop({
  sessions,
  model = 'auto',
  messages = [],
  tools = null,
  onEvent = null,
  maxSteps = MAX_STEPS,
  browserTool = null,
}) {
  const registry = createToolRegistry({ browserTool });
  const hotplugDefs = registry.list();
  const clientDefs = tools?.length ? openaiToolsToDefs(tools) : [];
  // Prefer HotPlug tools; allow client tools only if we can execute them by name
  const allowed = (clientDefs.length
    ? hotplugDefs.filter(t => clientDefs.some(c => c.name === t.name))
    : hotplugDefs);
  const toolDefs = allowed.length ? allowed : hotplugDefs;
  if (!toolDefs.length) throw new Error('No tools available for agent mode.');

  const history = [
    { role: 'system', content: toolCatalogPrompt(toolDefs) },
    ...messages.filter(m => m.role !== 'system'),
  ];

  const trace = [];
  let lastProvider = model;
  let totalLatency = 0;

  for (let step = 0; step < maxSteps; step++) {
    onEvent?.({ type: 'think', step, model });
    const turn = await bridgeToolTurn({
      sessions,
      model,
      messages: history,
      toolDefs,
      allowIntentFallback: true,
      maxRepairs: 2,
    });
    lastProvider = turn.provider;
    totalLatency += turn.latencyMs || 0;

    if (turn.finish_reason === 'stop' || !turn.tool_calls?.length) {
      const finalText = turn.content || stripToolCallBlocks(turn.raw) || turn.raw || '';
      onEvent?.({ type: 'final', content: finalText, provider: lastProvider });
      return {
        content: finalText,
        provider: lastProvider,
        latencyMs: totalLatency,
        steps: step + 1,
        trace,
        finish_reason: 'stop',
        repairs: turn.repairs,
      };
    }

    history.push({ role: 'assistant', content: turn.raw || JSON.stringify(turn.tool_calls) });
    for (const call of turn.tool_calls) {
      const name = call.function.name;
      let args = {};
      try { args = JSON.parse(call.function.arguments || '{}'); } catch { args = {}; }
      onEvent?.({ type: 'tool_start', name, arguments: args, step });
      let result;
      try {
        result = await registry.execute(name, args);
      } catch (error) {
        result = { ok: false, error: error.message };
      }
      const resultText = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
      trace.push({ name, arguments: args, result: resultText.slice(0, 12000) });
      history.push({ role: 'tool', content: `Tool ${name} result:\n${resultText.slice(0, 12000)}` });
      onEvent?.({ type: 'tool_end', name, result: resultText.slice(0, 2000), step });
    }
  }

  return {
    content: 'Agent stopped: max tool steps reached. Partial trace available.',
    provider: lastProvider,
    latencyMs: totalLatency,
    steps: maxSteps,
    trace,
    finish_reason: 'length',
  };
}

/**
 * Single-turn OpenAI-compatible tool calling (for OpenClaw / any client with tools).
 * Does NOT execute tools — returns tool_calls like a keyed API model.
 */
export async function runToolProtocolTurn({
  sessions,
  model = 'auto',
  messages = [],
  tools = [],
}) {
  const toolDefs = openaiToolsToDefs(tools);
  if (!toolDefs.length) throw new Error('tools array is empty');
  const turn = await bridgeToolTurn({
    sessions,
    model,
    messages,
    toolDefs,
    allowIntentFallback: false, // don't invent OpenClaw tool args
    maxRepairs: 2,
  });

  if (turn.finish_reason === 'tool_calls' && turn.tool_calls?.length) {
    return {
      finish_reason: 'tool_calls',
      message: { role: 'assistant', content: null, tool_calls: turn.tool_calls },
      provider: turn.provider,
      latencyMs: turn.latencyMs,
      repairs: turn.repairs,
    };
  }

  return {
    finish_reason: 'stop',
    message: { role: 'assistant', content: turn.content || '' },
    provider: turn.provider,
    latencyMs: turn.latencyMs,
    repairs: turn.repairs,
  };
}

export { filterValidCalls, parseToolCalls, buildPrompt };
