import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

function secretKey() {
  const raw = process.env.HOTPLUG_SECRET || 'hotplug-dev-secret-change-me';
  return crypto.createHash('sha256').update(raw).digest();
}

export class CredentialVault {
  constructor(root = process.env.HOTPLUG_DATA_DIR || path.resolve('data')) {
    this.file = path.join(root, 'credentials.enc.json');
    this.root = root;
  }

  encrypt(plain) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', secretKey(), iv);
    const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64url');
  }

  decrypt(blob) {
    const buf = Buffer.from(blob, 'base64url');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', secretKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }

  async read() {
    try { return JSON.parse(await fs.readFile(this.file, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return { providers: {} }; throw error; }
  }

  async write(data) {
    await fs.mkdir(this.root, { recursive: true });
    await fs.writeFile(this.file, JSON.stringify(data, null, 2), { mode: 0o600 });
  }

  async list() {
    const data = await this.read();
    return Object.entries(data.providers || {}).map(([id, row]) => ({
      id,
      email: row.email || '',
      hasPassword: Boolean(row.passwordEnc),
      updatedAt: row.updatedAt || null,
    }));
  }

  async get(id) {
    const row = (await this.read()).providers?.[id];
    if (!row?.passwordEnc) return null;
    return { email: row.email || '', password: this.decrypt(row.passwordEnc) };
  }

  async set(id, { email, password }) {
    const data = await this.read();
    data.providers = data.providers || {};
    data.providers[id] = {
      email: String(email || '').trim(),
      passwordEnc: this.encrypt(password),
      updatedAt: new Date().toISOString(),
    };
    await this.write(data);
    return { id, email: data.providers[id].email, hasPassword: true, updatedAt: data.providers[id].updatedAt };
  }

  async remove(id) {
    const data = await this.read();
    if (!data.providers?.[id]) return false;
    delete data.providers[id];
    await this.write(data);
    return true;
  }
}
