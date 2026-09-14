import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.on('uncaughtException', error => { console.error('[hotplug] uncaughtException:', error); process.exit(1); });
process.on('unhandledRejection', error => { console.error('[hotplug] unhandledRejection:', error); process.exit(1); });

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'index.html');
if (!fs.existsSync(dist)) {
  console.error('[hotplug] Missing dist/index.html. The build step must run before start.');
  process.exit(1);
}

const port = process.env.PORT || '(not set)';
const host = process.env.HOTPLUG_HOST || (process.env.PORT ? '0.0.0.0' : '127.0.0.1');
console.log(`[hotplug] Starting on ${host}:${port} (NODE_ENV=${process.env.NODE_ENV || 'unset'})`);

await import('../server/index.js');
