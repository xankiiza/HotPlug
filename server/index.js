import { createApp } from './app.js';

const port = Number(process.env.PORT || 8787);
const host = process.env.HOTPLUG_HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');
const publicHost = process.env.HOTPLUG_PUBLIC_HOST || '';
const server = createApp().listen(port, host, () => {
  console.log(`HotPlug is running on ${host}:${port}`);
  if (publicHost) console.log(`Public API: https://${publicHost}/v1`);
});
server.ref();
server.on('error', error => {
  console.error(`HotPlug API failed to start: ${error.code || error.message}`);
  process.exitCode = 1;
});
const shutdown = () => server.close(() => process.exit(0));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
