import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const configPath = process.env.OPENCLAW_CONFIG || path.join(os.homedir(), '.openclaw', 'openclaw.json');
const baseUrl = process.env.HOTPLUG_BASE_URL || 'http://127.0.0.1:8787/v1';
const preferredModel = process.env.HOTPLUG_OPENCLAW_MODEL || 'hotplug/gemini';

const modelDefs = ['auto', 'gemini', 'deepseek', 'claude', 'chatgpt'].map(id => ({
  id,
  name: `HotPlug ${id === 'auto' ? 'Auto' : id.charAt(0).toUpperCase() + id.slice(1)}`,
  api: 'openai-completions',
  reasoning: false,
  input: ['text'],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 128000,
  maxTokens: 8192,
}));

let config = {};
try {
  config = JSON.parse(await fs.readFile(configPath, 'utf8'));
} catch {
  console.error(`Missing ${configPath}`);
  process.exit(1);
}

config.agents = config.agents || {};
config.agents.defaults = config.agents.defaults || {};
config.agents.defaults.model = { ...(config.agents.defaults.model || {}), primary: preferredModel };

config.models = config.models || {};
config.models.mode = 'merge';
config.models.providers = config.models.providers || {};
const hp = config.models.providers.hotplug || {};
hp.baseUrl = baseUrl;
hp.api = hp.api || 'openai-completions';
hp.authHeader = hp.authHeader !== false;
hp.models = modelDefs;
config.models.providers.hotplug = hp;

await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
console.log(JSON.stringify({ configPath, primary: preferredModel, baseUrl, models: modelDefs.map(m => m.id) }, null, 2));
