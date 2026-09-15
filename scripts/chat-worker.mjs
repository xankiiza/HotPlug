#!/usr/bin/env node
import { ProviderSessionManager } from '../server/provider-sessions.js';

const id = process.argv[2];
const prompt = process.argv.slice(3).join(' ');
if (!id || !prompt) {
  console.error('Usage: chat-worker.mjs <providerId> <prompt...>');
  process.exit(2);
}

const sessions = new ProviderSessionManager(process.env.HOTPLUG_DATA_DIR);
try {
  const content = await sessions.send(id, prompt);
  process.stdout.write(JSON.stringify({ ok: true, content }));
} catch (error) {
  process.stdout.write(JSON.stringify({ ok: false, error: error.message }));
  process.exitCode = 1;
} finally {
  await sessions.close().catch(() => {});
}
