import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { FiArrowUpRight, FiCopy, FiCpu, FiKey, FiLogIn, FiLogOut, FiPlus, FiRefreshCw, FiSend, FiShield, FiTrash2, FiZap } from 'react-icons/fi';
import './styles.css';

const PUBLIC_API_URL = 'https://hotplug.xankiiza.com/v1';
const defaultApiUrl = () => `${window.location.origin}/v1`;

function useApiUrl() {
  const [apiUrl, setApiUrl] = useState(defaultApiUrl);
  useEffect(() => { fetch('/api/config').then(r => r.json()).then(c => c.apiUrl && setApiUrl(c.apiUrl)).catch(() => {}); }, []);
  return apiUrl;
}

function CopyEndpoint({ url, onCopy }) {
  const copy = async () => { await navigator.clipboard.writeText(url); onCopy?.(`Copied ${url}`); };
  return <button type="button" className="endpoint bare" onClick={copy} title="Copy API URL">{url} <FiCopy /></button>;
}

const openClawConfig = (apiUrl, apiKey = 'hp_...', model = 'auto') => `baseURL: "${apiUrl}"\napiKey: "${apiKey}"\nmodel: "${model}"`;

async function copyText(text, onCopy, label = 'Copied to clipboard') {
  try { await navigator.clipboard.writeText(text); onCopy?.(label); return true; }
  catch { onCopy?.('Copy failed — select the text and copy manually'); return false; }
}

function useCopyState() {
  const [copied, setCopied] = useState('');
  const mark = id => { setCopied(id); window.setTimeout(() => setCopied(current => current === id ? '' : current), 2000); };
  return { copied, mark };
}

function OpenClawConfig({ apiUrl, apiKey, model = 'auto' }) {
  return <pre><span>// OpenClaw configuration</span>{'\n'}baseURL: <i>"{apiUrl}"</i>{'\n'}apiKey: <i>"{apiKey || 'hp_...'}"</i>{'\n'}model: <i>"{model}"</i> <span>// auto, gemini, deepseek, claude, chatgpt, or hotplug/&lt;id&gt;</span></pre>;
}

function KeyRevealModal({ keyRecord, apiUrl, onClose, setNotice }) {
  const { copied, mark } = useCopyState();
  if (!keyRecord) return null;
  const config = openClawConfig(apiUrl, keyRecord.token);
  const copyKey = async () => { if (await copyText(keyRecord.token, setNotice, 'API key copied')) mark('modal-key'); };
  const copyConfig = async () => { if (await copyText(config, setNotice, 'OpenClaw config copied')) mark('modal-config'); };
  return <div className="modal-backdrop" onClick={onClose}><div className="modal" onClick={e => e.stopPropagation()}><button type="button" className="modal-close" onClick={onClose}>×</button><label>NEW API KEY</label><h2>{keyRecord.name}</h2><p>Your key is ready. Copy it below and paste into OpenClaw.</p><input readOnly value={keyRecord.token} onFocus={e => e.target.select()} /><div className="modal-actions"><button type="button" className={'button' + (copied === 'modal-key' ? ' copied' : '')} onClick={copyKey}><FiCopy /> {copied === 'modal-key' ? 'Copied!' : 'Copy key'}</button><button type="button" className={'button outline-button' + (copied === 'modal-config' ? ' copied' : '')} onClick={copyConfig}><FiCopy /> {copied === 'modal-config' ? 'Copied!' : 'Copy config'}</button></div><small>Keep this key secret. Use it as <code>Bearer {keyRecord.token.slice(0, 8)}…</code> in OpenClaw.</small><button type="button" className="button modal-done" onClick={onClose}>Done</button></div></div>;
}

function KeyCard({ keyRecord, apiUrl, onRemove, setNotice }) {
  const { copied, mark } = useCopyState();
  const copyKey = async () => { if (!keyRecord.token) return; if (await copyText(keyRecord.token, setNotice, 'API key copied')) mark(`${keyRecord.id}-key`); };
  const copyConfig = async () => { if (!keyRecord.token) return; if (await copyText(openClawConfig(apiUrl, keyRecord.token), setNotice, 'OpenClaw config copied')) mark(`${keyRecord.id}-config`); };
  return <article className="key-card"><div className="key-card-head"><strong>{keyRecord.name}</strong><button type="button" className="icon-button" title="Revoke key" onClick={() => onRemove(keyRecord.id)}><FiTrash2 /></button></div><div className="key-token-box"><code title={keyRecord.token || keyRecord.prefix}>{keyRecord.token || `${keyRecord.prefix}••••••`}</code><button type="button" className={'token-copy' + (copied === `${keyRecord.id}-token` ? ' copied' : '')} disabled={!keyRecord.token} onClick={async () => { if (await copyText(keyRecord.token, setNotice, 'API key copied')) mark(`${keyRecord.id}-token`); }} title="Copy key"><FiCopy /></button></div><div className="key-card-actions">{keyRecord.token ? <><button type="button" className={'copy-key-button' + (copied === `${keyRecord.id}-key` ? ' copied' : '')} onClick={copyKey}><FiCopy /> {copied === `${keyRecord.id}-key` ? 'Copied!' : 'Copy key'}</button><button type="button" className={'copy-key-button' + (copied === `${keyRecord.id}-config` ? ' copied' : '')} onClick={copyConfig}><FiKey /> {copied === `${keyRecord.id}-config` ? 'Copied!' : 'Copy config'}</button></> : <p className="key-stale">This key was created before copy support. Revoke it and create a new one.</p>}</div></article>;
}

const api = async (url, options = {}) => {
  let response;
  try { response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } }); }
  catch { throw new Error('HotPlug gateway is offline or unreachable. Check that the Node app is running.'); }
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : {}; }
  catch { throw new Error(`Gateway returned an invalid response (${response.status}). Usually the Node process crashed, timed out, or Chromium/Browserless failed.`); }
  if (!response.ok) throw new Error(data.error?.message || `Request failed (${response.status})`);
  return data;
};

function App() {
  const [view, setView] = useState('home'), [session, setSession] = useState({ loading: true, authenticated: false });
  useEffect(() => { api('/api/auth/status').then(setSession).catch(() => setSession({ loading: false, authenticated: false })); }, []);
  const begin = () => setView(session.authenticated ? 'admin' : 'login');
  const logout = async () => { await api('/api/auth/logout', { method: 'POST' }); setSession({ authenticated: false }); setView('home'); };
  return <div className="app">
    <header><button className="logo bare" onClick={() => setView('home')}><b><FiZap /></b>hotplug<span>.</span></button><nav><a href="#how">How it works</a><a href="#providers">Providers</a><a href="#api">API reference</a></nav>{session.authenticated ? <div className="session-actions"><button className="signin-button" onClick={() => setView('admin')}>Admin <FiArrowUpRight /></button><button className="signout-button" onClick={logout}><FiLogOut /> Sign Out</button></div> : <button className="signin-button" onClick={begin}><FiLogIn /> Sign In</button>}</header>
    {view === 'admin' && session.authenticated ? <Admin /> : view === 'login' && !session.authenticated ? <Login onSuccess={result => { setSession(result); setView('admin'); }} /> : <Home onStart={begin} />}
  </div>;
}

function Login({ onSuccess }) {
  const [email, setEmail] = useState('xankiiza@gmail.com'), [password, setPassword] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const submit = async event => { event.preventDefault(); setBusy(true); setError(''); try { onSuccess(await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })); } catch (failure) { setError(failure.message); } finally { setBusy(false); } };
  return <main className="login-page"><form className="login-card" onSubmit={submit}><div className="brand-mark-large"><FiZap /></div><label>HOTPLUG ADMIN</label><h1>Welcome back.</h1><p>Sign in to manage providers, browser sessions, and OpenClaw keys.</p>{error && <div className="login-error">{error}</div>}<label htmlFor="email">Email</label><input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" required /><label htmlFor="password">Password</label><input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" autoFocus required /><button className="button login-submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign In'} <FiArrowUpRight /></button><small><FiShield /> Protected local session · 12 hour expiry</small></form></main>;
}

const publicProviders = [['G', 'Gemini', 'auto-routed'], ['D', 'DeepSeek', 'auto-routed'], ['C', 'Claude', 'auto-routed'], ['O', 'ChatGPT', 'auto-routed']];
function Home({ onStart }) {
  const cards = [[FiLogIn, 'Open a provider session', 'HotPlug launches Chromium. You complete the provider login yourself.'], [FiKey, 'Create an OpenClaw key', 'Only its SHA-256 hash is persisted. Copy the key when it is created.'], [FiZap, 'Send real requests', 'HotPlug auto-routes each prompt to the best signed-in provider for speed and task fit.']];
  return <><section className="hero" id="top"><div className="copy"><h1>You don’t need<br /><i>API keys anymore.</i></h1><p>HotPlug turns AI accounts you already use into one OpenAI-compatible API. Sign in once, route requests through HotPlug, and keep your data in your hands.</p><div className="actions"><button className="button" onClick={onStart}>Sign In <FiArrowUpRight /></button><a className="play" href="#how"><span>→</span> See how it works</a></div><small className="trust"><FiShield /> Credentials are entered only in each provider’s browser window</small></div><div className="visual"><div className="rings" /><div className="core"><FiZap /></div><div className="terminal"><div className="top">● ● ● &nbsp; hotplug · gateway <em>● LIVE</em></div><div className="term"><p className="dim">$ curl {PUBLIC_API_URL}/models</p><p><strong>✓</strong> Gateway on <span className="cyan">hotplug.xankiiza.com</span></p><p className="dim">$ POST /v1/chat/completions</p><div className="request"><b>POST</b> OpenAI-compatible request<br /><small>⚙ auto route <span>→</span> browser session</small></div></div></div></div></section>
    <section className="strip" id="providers"><div className="strip-label">SUPPORTED PROVIDERS<br /><b>AUTO-ROUTED</b></div>{publicProviders.map(([letter, name, model]) => <div className="provider" key={name}><span className={'picon ' + name.toLowerCase()}>{letter}</span><div><strong>{name}</strong><small>{model}</small></div></div>)}</section>
    <section className="content" id="how"><label>THE HOTPLUG WAY</label><div className="heading"><h2>Sign in once.<br /><span>Route automatically.</span></h2><p>Create a key in the dashboard, then point OpenClaw at the HotPlug API URL below.</p></div><div className="steps">{cards.map(([Icon, title, text]) => <article key={title}><Icon /><h3>{title}</h3><p>{text}</p></article>)}</div></section>
    <section className="api" id="api"><div><label>OPENAI COMPATIBLE</label><h2>Keep your stack.<br /><i>Change the endpoint.</i></h2><p>Create a HotPlug key after signing in. Use <code>auto</code> for smart routing, or pick a provider: <code>gemini</code>, <code>deepseek</code>, <code>claude</code>, <code>chatgpt</code> (also <code>hotplug/gemini</code> etc.).</p><CopyEndpoint url={PUBLIC_API_URL} /></div><OpenClawConfig apiUrl={PUBLIC_API_URL} /></section>
    <section className="cta"><div><label>READY WHEN YOU ARE</label><h2>Sign in. Test. Connect.</h2></div><button className="button" onClick={onStart}>Sign In <FiArrowUpRight /></button></section><footer><button className="logo bare" onClick={() => scrollTo(0, 0)}><b><FiZap /></b>hotplug<span>.</span></button><small>Local AI browser gateway.</small><small>© {new Date().getFullYear()} <a href="https://xankiiza.com" target="_blank" rel="noreferrer">xankiiza</a></small><small>v0.2</small></footer></>;
}

function Admin() {
  const apiUrl = useApiUrl();
  const [providers, setProviders] = useState([]), [keys, setKeys] = useState([]), [notice, setNotice] = useState(''), [busy, setBusy] = useState(''), [loading, setLoading] = useState(true);
  const refresh = async () => { setLoading(true); const [providerResult, keyResult] = await Promise.allSettled([api('/api/admin/providers'), api('/api/admin/keys')]); if (providerResult.status === 'fulfilled') setProviders(providerResult.value.providers); else setNotice(providerResult.reason.message); if (keyResult.status === 'fulfilled') setKeys(keyResult.value.keys); else setNotice(keyResult.reason.message); setLoading(false); };
  useEffect(() => { refresh(); }, []);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(''), 2800); return () => window.clearTimeout(timer); }, [notice]);
  const login = async id => { setBusy(id); try { const result = await api(`/api/admin/providers/${id}/login`, { method: 'POST' }); if (result.liveURL) window.open(result.liveURL, '_blank', 'noopener,noreferrer'); setNotice(result.liveURL ? `${result.message} Link opened in a new tab.` : result.message); await refresh(); } catch (error) { setNotice(error.message); } finally { setBusy(''); } };
  const verify = async id => { setBusy(id); try { await api(`/api/admin/providers/${id}/verify`, { method: 'POST' }); setNotice('Session verified. This provider is ready.'); await refresh(); } catch (error) { setNotice(error.message); } finally { setBusy(''); } };
  const isProduction = window.location.hostname === 'hotplug.xankiiza.com';
  return <main className="admin-page">{notice && <div className="notice" onClick={() => setNotice('')}>{notice}</div>}<div className="admin-heading"><div><label>CONTROL CENTER</label><h1>HotPlug <i>gateway.</i></h1><p>Connect providers, create API keys, and copy the OpenClaw endpoint below.</p></div><span className="local-badge"><b /> {isProduction ? 'hotplug.xankiiza.com' : 'LOCAL'}</span></div><div className="admin-grid"><section className="panel"><div className="panel-title"><div><label>PROVIDER SESSIONS</label><h2>Browser profiles</h2></div><button className="icon-button" onClick={refresh}><FiRefreshCw /></button></div>{loading && providers.length === 0 ? <div className="provider-loading">Loading providers…</div> : providers.length === 0 ? <div className="provider-loading error">Providers could not be loaded. <button onClick={refresh}>Retry</button></div> : providers.map(p => <div className="provider-row" key={p.id}><span className={'picon ' + p.id}>{p.name[0]}</span><div className="provider-info"><strong>{p.name}</strong><small>{p.model} · {p.connected ? 'Local profile found' : 'Not signed in'}</small></div><span className={'session-status ' + (p.connected ? 'ready' : 'off')}><b /> {p.running ? 'Browser open' : p.connected ? 'Profile saved' : 'Disconnected'}</span><button className="connect-button" disabled={busy === p.id} onClick={() => p.connected ? verify(p.id) : login(p.id)}>{busy === p.id ? 'Opening…' : p.connected ? 'Verify' : 'Sign In'} <FiArrowUpRight /></button></div>)}</section><Keys keys={keys} apiUrl={apiUrl} refresh={refresh} setNotice={setNotice} /></div><Chat providers={providers.filter(p => p.connected)} setNotice={setNotice} /><section className="endpoint-panel"><div><label>OPENCLAW ENDPOINT</label><CopyEndpoint url={apiUrl} onCopy={setNotice} /><p>Use a generated <code>hp_...</code> key as the Bearer token. Set model to <code>auto</code> or a provider id (<code>gemini</code>, <code>hotplug/gemini</code>, etc.).</p></div><OpenClawConfig apiUrl={apiUrl} /></section></main>;
}

function Keys({ keys, apiUrl, refresh, setNotice }) {
  const [name, setName] = useState('OpenClaw'), [revealed, setRevealed] = useState(null);
  const create = async event => { event.preventDefault(); try { const key = await api('/api/admin/keys', { method: 'POST', body: JSON.stringify({ name }) }); setRevealed({ id: key.id, name: key.name, token: key.token }); await copyText(key.token, setNotice, 'API key copied'); await refresh(); } catch (error) { setNotice(error.message); } };
  const remove = async id => { try { await api(`/api/admin/keys/${id}`, { method: 'DELETE' }); if (revealed?.id === id) setRevealed(null); setNotice('Key revoked'); await refresh(); } catch (error) { setNotice(error.message); } };
  return <section className="panel keys-panel"><KeyRevealModal keyRecord={revealed} apiUrl={apiUrl} onClose={() => setRevealed(null)} setNotice={setNotice} /><div className="panel-title"><div><label>ACCESS CONTROL</label><h2>API keys</h2></div><FiKey /></div><p className="panel-copy">Point OpenClaw at <strong>{apiUrl}</strong></p><form className="key-form" onSubmit={create}><input value={name} onChange={e => setName(e.target.value)} placeholder="Key name" required /><button className="button"><FiPlus /> Create</button></form>{keys.length === 0 ? <p className="panel-copy">No keys created yet.</p> : <div className="key-list">{keys.map(k => <KeyCard key={k.id} keyRecord={k} apiUrl={apiUrl} onRemove={remove} setNotice={setNotice} />)}</div>}</section>;
}

function Chat({ providers, setNotice }) {
  const [prompt, setPrompt] = useState(''), [messages, setMessages] = useState([]), [sending, setSending] = useState(false), [model, setModel] = useState('auto');
  useEffect(() => { if (model !== 'auto' && !providers.some(p => p.id === model)) setModel('auto'); }, [providers, model]);
  const modelLabel = model === 'auto' ? 'auto (smart route)' : model;
  const send = async event => { event.preventDefault(); if (!prompt.trim() || !providers.length) return; const text = prompt; setPrompt(''); setMessages(m => [...m, { role: 'user', text, model: modelLabel }]); setSending(true); try { const response = await fetch('/api/admin/test-chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, messages: [{ role: 'user', content: text }] }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error?.message || `Request failed (${response.status})`); const provider = response.headers.get('x-hotplug-provider') || result.system_fingerprint?.replace('hotplug-', '') || model; setMessages(m => [...m, { role: 'assistant', text: result.choices[0].message.content, provider, model: result.model }]); } catch (error) { setMessages(m => [...m, { role: 'error', text: error.message }]); setNotice(error.message); } finally { setSending(false); } };
  return <section className="chat-panel"><div className="panel-title"><div><label>LIVE BROWSER TEST</label><h2>Test chat</h2></div><span>{providers.length} profiles · model {modelLabel}</span></div><div className="chat-window">{messages.length === 0 ? <div className="chat-empty"><FiCpu /><strong>{providers.length ? 'Ready for a real test' : 'Sign in to a provider first'}</strong><small>Choose auto for smart routing, or pin a specific signed-in provider.</small></div> : messages.map((m, i) => <div className={'message ' + m.role} key={i}><small>{m.role === 'user' ? `You · ${m.model || modelLabel}` : m.role === 'error' ? 'Error' : m.model === 'auto' ? `Auto → ${m.provider}` : m.provider || 'Assistant'}</small><p>{m.text}</p></div>)}</div><form className="chat-form" onSubmit={send}><select value={model} onChange={e => setModel(e.target.value)} disabled={!providers.length || sending} aria-label="Model"><option value="auto">auto — smart route</option>{providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><input value={prompt} onChange={e => setPrompt(e.target.value)} disabled={!providers.length || sending} placeholder={providers.length ? 'Ask a connected AI…' : 'Sign in above first'} /><button className="button" disabled={!providers.length || sending}><FiSend /> {sending ? 'Waiting…' : 'Send'}</button></form></section>;
}

createRoot(document.getElementById('root')).render(<App />);
