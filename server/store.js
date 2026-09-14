import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export class Store {
  constructor(root = process.env.HOTPLUG_DATA_DIR || path.resolve('data')) {
    this.root = root;
    this.file = path.join(root, 'hotplug.json');
  }
  async read() {
    try { return JSON.parse(await fs.readFile(this.file, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return { keys: [] }; throw error; }
  }
  async write(data) {
    await fs.mkdir(this.root, { recursive: true });
    await fs.writeFile(this.file, JSON.stringify(data, null, 2), { mode: 0o600 });
  }
  async listKeys() { return (await this.read()).keys.map(({ hash, ...key }) => key); }
  async createKey(name = 'OpenClaw') {
    const token = `hp_${crypto.randomBytes(24).toString('base64url')}`;
    const data = await this.read();
    const record = { id: crypto.randomUUID(), name: String(name).slice(0, 80), prefix: token.slice(0, 11), hash: this.hash(token), createdAt: new Date().toISOString() };
    data.keys.push(record); await this.write(data);
    return { ...record, token, hash: undefined };
  }
  async deleteKey(id) { const data = await this.read(); const before = data.keys.length; data.keys = data.keys.filter(k => k.id !== id); await this.write(data); return before !== data.keys.length; }
  async verifyKey(token) { if (!token) return false; const hash = this.hash(token); return (await this.read()).keys.some(k => crypto.timingSafeEqual(Buffer.from(k.hash), Buffer.from(hash))); }
  hash(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
}
