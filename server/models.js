import { providers } from './providers.js';

export const AUTO_MODEL = 'auto';

export function listModels() {
  const providerModels = Object.entries(providers).map(([id, p]) => ({
    id,
    object: 'model',
    created: 1789344000,
    owned_by: 'hotplug',
    root: `hotplug/${id}`,
  }));
  return [
    { id: AUTO_MODEL, object: 'model', created: 1789344000, owned_by: 'hotplug', root: 'hotplug/auto' },
    ...providerModels,
  ];
}

/** @returns {'auto' | string} provider id or 'auto' */
export function resolveModel(model) {
  const raw = String(model || AUTO_MODEL).trim();
  if (!raw || raw === AUTO_MODEL) return AUTO_MODEL;
  const normalized = raw.toLowerCase().replace(/^hotplug\//, '');
  if (normalized === AUTO_MODEL) return AUTO_MODEL;
  if (providers[normalized]) return normalized;
  throw new Error(`Unknown model "${raw}". Use auto or one of: ${Object.keys(providers).join(', ')}`);
}

export function responseModel(requested) {
  const resolved = resolveModel(requested);
  return resolved === AUTO_MODEL ? AUTO_MODEL : resolved;
}
