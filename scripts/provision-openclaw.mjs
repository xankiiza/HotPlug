import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../server/store.js';

const baseUrl = process.env.HOTPLUG_BASE_URL || `http://127.0.0.1:${process.env.PORT || 8787}/v1`;
const store = new Store();
const key = await store.createKey('OpenClaw');
const openclawDir = path.join(os.homedir(), '.openclaw');
const configPath = path.join(openclawDir, 'openclaw.json');

const hotplugProvider = {
  baseUrl,
  apiKey: key.token,
  api: 'openai-completions',
  authHeader: true,
  models: [
    {
      id: 'auto',
      name: 'HotPlug Auto',
      api: 'openai-completions',
      reasoning: false,
      input: ['text'],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 128000,
      maxTokens: 8192,
    },
  ],
};

let config = {};
try {
  config = JSON.parse(await fs.readFile(configPath, 'utf8'));
} catch {
  // fresh install
}

config.agents = config.agents || {};
config.agents.defaults = config.agents.defaults || {};
config.agents.defaults.model = { ...(config.agents.defaults.model || {}), primary: 'hotplug/auto' };

config.models = config.models || {};
config.models.mode = 'merge';
config.models.providers = config.models.providers || {};
config.models.providers.hotplug = hotplugProvider;

await fs.mkdir(openclawDir, { recursive: true });
await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');

console.log(JSON.stringify({ baseUrl, apiKey: key.token, configPath, openclawModel: 'hotplug/auto' }, null, 2));
