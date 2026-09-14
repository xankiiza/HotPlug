import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ProviderSessionManager } from './provider-sessions.js';
import { Store } from './store.js';
import { AuthManager } from './auth.js';

export function createApp({ sessions = new ProviderSessionManager(), store = new Store(), auth = new AuthManager() } = {}) {
  const app = express();
  const publicHost = process.env.HOTPLUG_PUBLIC_HOST || '';
  if (publicHost) app.set('trust proxy', 1);
  const allowedOrigin = origin => !origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) || (publicHost && origin === `https://${publicHost}`);
  app.use(cors({ origin: (origin, cb) => allowedOrigin(origin) ? cb(null, true) : cb(new Error('Origin not allowed')) }));
  app.use(express.json({ limit: '1mb' }));
  const adminAllowed = req => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress) || (publicHost && req.hostname === publicHost);
  const localAdmin = (req, res, next) => adminAllowed(req) ? next() : res.status(403).json({ error: { message: 'Admin is unavailable from this host.' } });
  const signedIn = (req, res, next) => auth.authenticated(req) ? next() : res.status(401).json({ error: { message: 'Sign in to HotPlug first.', type: 'authentication_error' } });
  const apiKey = async (req, res, next) => (await store.verifyKey((req.headers.authorization || '').replace(/^Bearer\s+/i, ''))) ? next() : res.status(401).json({ error: { message: 'Valid HotPlug API key required.', type: 'authentication_error' } });
  const reqProtocol = req => req.get('x-forwarded-proto') || req.protocol;
  const reqHost = req => req.get('x-forwarded-host') || req.get('host');
  const apiUrlFor = req => publicHost ? `https://${publicHost}/v1` : `${reqProtocol(req)}://${reqHost(req)}/v1`;
  app.get('/api/health', async (_, res) => res.json({ status: 'ok', browser: sessions.remote ? 'browserless' : 'local', providers: await sessions.list() }));
  app.get('/api/config', (req, res) => res.json({ apiUrl: apiUrlFor(req), model: 'auto', publicHost: publicHost || null, browser: sessions.remote ? 'browserless' : 'local' }));
  app.get('/api/auth/status', localAdmin, (req, res) => res.json({ authenticated: auth.authenticated(req), email: auth.authenticated(req) ? 'xankiiza@gmail.com' : null }));
  app.post('/api/auth/login', localAdmin, (req, res) => { if (!auth.validCredentials(req.body?.email, req.body?.password)) return res.status(401).json({ error: { message: 'Incorrect email or password.', type: 'authentication_error' } }); const token = auth.createSession(); res.setHeader('Set-Cookie', auth.cookie(token)); res.json({ authenticated: true, email: 'xankiiza@gmail.com' }); });
  app.post('/api/auth/logout', localAdmin, signedIn, (req, res) => { auth.revoke(req); res.setHeader('Set-Cookie', auth.clearCookie()); res.json({ authenticated: false }); });
  app.get('/api/admin/providers', localAdmin, signedIn, async (_, res) => res.json({ providers: await sessions.list() }));
  app.post('/api/admin/providers/:id/login', localAdmin, signedIn, async (req, res, next) => { try { res.json(await sessions.openLogin(req.params.id)); } catch (e) { next(e); } });
  app.post('/api/admin/providers/:id/verify', localAdmin, signedIn, async (req, res, next) => { try { res.json(await sessions.verify(req.params.id)); } catch (e) { next(e); } });
  app.get('/api/admin/providers/:id/diagnose', localAdmin, signedIn, async (req, res, next) => { try { res.json(await sessions.diagnose(req.params.id, String(req.query.draft || '').slice(0, 100))); } catch (e) { next(e); } });
  app.get('/api/admin/keys', localAdmin, signedIn, async (_, res) => res.json({ keys: await store.listKeys() }));
  app.post('/api/admin/keys', localAdmin, signedIn, async (req, res, next) => { try { res.status(201).json(await store.createKey(req.body?.name)); } catch (e) { next(e); } });
  app.delete('/api/admin/keys/:id', localAdmin, signedIn, async (req, res, next) => { try { res.json({ deleted: await store.deleteKey(req.params.id) }); } catch (e) { next(e); } });
  const MODEL = 'auto';
  const modelObject = { id: MODEL, object: 'model', created: 1789344000, owned_by: 'hotplug' };
  app.get('/v1/models', apiKey, (_, res) => res.json({ object: 'list', data: [modelObject] }));
  app.get('/v1/models/auto', apiKey, (_, res) => res.json(modelObject));
  const messageText = content => typeof content === 'string' ? content : Array.isArray(content) ? content.filter(p => p?.type === 'text').map(p => p.text).join('\n') : content == null ? '' : JSON.stringify(content);
  const estimateTokens = text => Math.max(1, Math.ceil(String(text).length / 4));
  const buildUsage = (prompt, completion) => { const prompt_tokens = estimateTokens(prompt), completion_tokens = estimateTokens(completion); return { prompt_tokens, completion_tokens, total_tokens: prompt_tokens + completion_tokens }; };
  const completion = async (req, res, next) => { try {
    const messages = req.body?.messages;
    if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: { message: 'messages must be a non-empty array', type: 'invalid_request_error', param: 'messages', code: null } });
    const prompt = messages.map(m => `${m.role}: ${messageText(m.content)}`).join('\n\n');
    const routed = await sessions.sendAuto(prompt), id = `chatcmpl-${crypto.randomUUID()}`, created = Math.floor(Date.now() / 1000), usage = buildUsage(prompt, routed.content);
    res.setHeader('x-hotplug-provider', routed.provider); res.setHeader('x-hotplug-latency-ms', String(routed.latencyMs));
    if (req.body.stream === true) {
      res.status(200); res.setHeader('Content-Type', 'text/event-stream; charset=utf-8'); res.setHeader('Cache-Control', 'no-cache, no-transform'); res.setHeader('Connection', 'keep-alive'); res.setHeader('X-Accel-Buffering', 'no');
      const chunk = (delta, finish_reason = null) => ({ id, object: 'chat.completion.chunk', created, model: MODEL, system_fingerprint: `hotplug-${routed.provider}`, choices: [{ index: 0, delta, finish_reason }] });
      res.write(`data: ${JSON.stringify(chunk({ role: 'assistant' }))}\n\n`);
      res.write(`data: ${JSON.stringify(chunk({ content: routed.content }))}\n\n`);
      res.write(`data: ${JSON.stringify({ id, object: 'chat.completion.chunk', created, model: MODEL, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage })}\n\n`);
      res.end('data: [DONE]\n\n'); return;
    }
    res.json({ id, object: 'chat.completion', created, model: MODEL, system_fingerprint: `hotplug-${routed.provider}`, choices: [{ index: 0, message: { role: 'assistant', content: routed.content }, finish_reason: 'stop' }], usage });
  } catch (e) { next(e); } };
  app.post('/api/admin/test-chat', localAdmin, signedIn, completion);
  app.post('/v1/chat/completions', apiKey, completion);
  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
  app.use(express.static(dist)); app.use((req, res, next) => req.method === 'GET' && !req.path.startsWith('/api/') && !req.path.startsWith('/v1/') ? res.sendFile(path.join(dist, 'index.html')) : next());
  app.use((error, _req, res, _next) => res.status(502).json({ error: { message: error.message, type: 'hotplug_error' } }));
  return app;
}
