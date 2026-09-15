import { createApp } from './app.js';

const port = Number(process.env.PORT || 8787);
const host = process.env.HOTPLUG_HOST || (process.env.PORT ? '0.0.0.0' : '127.0.0.1');
const publicHost = process.env.HOTPLUG_PUBLIC_HOST || '';
const app = createApp();
const server = app.listen(port, host, () => {
  console.log(`[hotplug] Listening on http://${host}:${port}`);
  if (publicHost) console.log(`[hotplug] Public API: https://${publicHost}/v1`);
});
server.requestTimeout = 300000;
server.headersTimeout = 310000;
server.keepAliveTimeout = 310000;
server.on('error', error => {
  console.error(`[hotplug] Failed to bind ${host}:${port}:`, error.code || error.message);
  process.exit(1);
});
const shutdown = () => server.close(() => process.exit(0));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
