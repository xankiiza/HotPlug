import crypto from 'node:crypto';

const EMAIL = 'xankiiza@gmail.com';
const SALT = 'hotplug-local-auth-v1';
const PASSWORD_HASH = '6e103be12698d50e41ad3036376435cb3fbe23e49198b89435aa7fbb5fbcefa902bfc6e99bd5ce807467298d4755278bcd7476c2877a583b4fecffe64f35ed93';

export class AuthManager {
  constructor() { this.sessions = new Map(); }
  validCredentials(email, password) {
    if (String(email).trim().toLowerCase() !== EMAIL) return false;
    const supplied = crypto.scryptSync(String(password), SALT, 64);
    return crypto.timingSafeEqual(supplied, Buffer.from(PASSWORD_HASH, 'hex'));
  }
  createSession() { const token = crypto.randomBytes(32).toString('base64url'); this.sessions.set(token, Date.now() + 12 * 60 * 60 * 1000); return token; }
  tokenFrom(req) { const match = String(req.headers.cookie || '').match(/(?:^|;\s*)hotplug_session=([^;]+)/); return match ? match[1] : ''; }
  authenticated(req) { const token = this.tokenFrom(req), expires = this.sessions.get(token); if (!expires || expires < Date.now()) { if (token) this.sessions.delete(token); return false; } return true; }
  revoke(req) { this.sessions.delete(this.tokenFrom(req)); }
  cookie(token) { const secure = process.env.HOTPLUG_PUBLIC_HOST ? '; Secure' : ''; return `hotplug_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secure}`; }
  clearCookie() { const secure = process.env.HOTPLUG_PUBLIC_HOST ? '; Secure' : ''; return `hotplug_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`; }
}
