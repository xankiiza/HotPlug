import { createApp } from './app.js';
const port = Number(process.env.PORT || 8787);
const server = createApp().listen(port, '127.0.0.1', () => console.log(`HotPlug is running at http://127.0.0.1:${port}`));
server.ref();
server.on('error', error => {
  console.error(`HotPlug API failed to start: ${error.code || error.message}`);
  process.exitCode = 1;
});
const shutdown = () => server.close(() => process.exit(0));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
