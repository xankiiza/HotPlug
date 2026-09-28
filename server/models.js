import { providers } from './providers.js';

export const AUTO_MODEL = 'auto';
export const AGENT_MODEL = 'agent';

export function listModels() {
  const providerModels = Object.entries(providers).map(([id]) => ({
    id,
    object: 'model',
    created: 1789344000,
    owned_by: 'hotplug',
    root: `hotplug/${id}`,
  }));
  const agentModels = [
    { id: AGENT_MODEL, object: 'model', created: 1789344000, owned_by: 'hotplug', root: 'hotplug/agent' },
    ...Object.keys(providers).map(id => ({
      id: `agent/${id}`,
      object: 'model',
      created: 1789344000,
      owned_by: 'hotplug',
      root: `hotplug/agent/${id}`,
    })),
  ];
  return [
    { id: AUTO_MODEL, object: 'model', created: 1789344000, owned_by: 'hotplug', root: 'hotplug/auto' },
    ...providerModels,
    ...agentModels,
  ];
}

/** @returns {{ mode: 'chat'|'agent', brain: 'auto'|string }} */
export function resolveModel(model) {
  const raw = String(model || AUTO_MODEL).trim();
  if (!raw || raw === AUTO_MODEL) return { mode: 'chat', brain: AUTO_MODEL };
  let normalized = raw.toLowerCase().replace(/^hotplug\//, '');
  if (normalized === AUTO_MODEL) return { mode: 'chat', brain: AUTO_MODEL };
  if (normalized === AGENT_MODEL || normalized === 'agent/auto') return { mode: 'agent', brain: AUTO_MODEL };
  if (normalized.startsWith('agent/')) {
    const brain = normalized.slice('agent/'.length);
    if (brain === AUTO_MODEL || providers[brain]) return { mode: 'agent', brain };
    throw new Error(`Unknown agent brain "${brain}". Use agent, agent/auto, or agent/<provider>.`);
  }
  if (providers[normalized]) return { mode: 'chat', brain: normalized };
  throw new Error(`Unknown model "${raw}". Use auto, a provider id, agent, or agent/<provider>.`);
}

export function responseModel(requested) {
  const { mode, brain } = resolveModel(requested);
  if (mode === 'agent') return brain === AUTO_MODEL ? AGENT_MODEL : `agent/${brain}`;
  return brain;
}
