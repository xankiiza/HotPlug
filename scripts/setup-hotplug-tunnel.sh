#!/usr/bin/env bash
set -euo pipefail
export PATH="/data/data/com.termux/files/usr/bin:$PATH"
PD=/data/data/com.termux/files/usr/bin/proot-distro
TUNNEL="max-homeserver"
TUNNEL_ID="5602aa0f-fc4e-47fa-bdd2-5cb2f07657df"
HOST="hotplug.xankiiza.com"

echo "=== update cloudflared config ==="
$PD login ubuntu -- bash -lc "cat > /root/.cloudflared/config.yml <<'EOF'
tunnel: ${TUNNEL_ID}
credentials-file: /root/.cloudflared/${TUNNEL_ID}.json

ingress:
  - hostname: max.xankiiza.com
    service: http://127.0.0.1:18789
  - hostname: ${HOST}
    service: http://127.0.0.1:8787
  - service: http_status:404
EOF
cat /root/.cloudflared/config.yml"

echo "=== route DNS (Cloudflare CNAME) ==="
$PD login ubuntu -- bash -lc "cloudflared tunnel route dns ${TUNNEL} ${HOST} 2>&1 || true"

echo "=== update HotPlug env ==="
$PD login ubuntu -- bash -lc "cat > /root/start-hotplug.sh <<'START'
#!/usr/bin/env bash
export HOTPLUG_DATA_DIR=/root/hotplug-data
export HOTPLUG_HOST=127.0.0.1
export HOTPLUG_PUBLIC_HOST=${HOST}
export PORT=8787
export NODE_ENV=production
export HOTPLUG_HEADLESS=true
cd /root/hotplug
exec node scripts/start.js
START
chmod +x /root/start-hotplug.sh"

echo "=== ensure OpenClaw uses local HotPlug ==="
$PD login ubuntu -- bash -lc "node <<'NODE'
const fs = require('fs');
const p = '/root/.openclaw/openclaw.json';
const c = JSON.parse(fs.readFileSync(p, 'utf8'));
c.agents = c.agents || {};
c.agents.defaults = c.agents.defaults || {};
c.agents.defaults.model = { ...(c.agents.defaults.model || {}), primary: 'hotplug/gemini' };
c.models = c.models || {};
c.models.mode = 'merge';
c.models.providers = c.models.providers || {};
const hp = c.models.providers.hotplug || {};
hp.baseUrl = 'http://127.0.0.1:8787/v1';
hp.api = hp.api || 'openai-completions';
hp.authHeader = hp.authHeader !== false;
if (!hp.apiKey) {
  console.error('No HotPlug API key in openclaw.json — run provision-openclaw.mjs first');
  process.exit(1);
}
hp.models = [
  { id: 'auto', name: 'HotPlug Auto', api: 'openai-completions', reasoning: false, input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 128000, maxTokens: 8192 },
  { id: 'gemini', name: 'HotPlug Gemini', api: 'openai-completions', reasoning: false, input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 128000, maxTokens: 8192 },
  { id: 'deepseek', name: 'HotPlug DeepSeek', api: 'openai-completions', reasoning: false, input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 128000, maxTokens: 8192 },
  { id: 'claude', name: 'HotPlug Claude', api: 'openai-completions', reasoning: false, input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 128000, maxTokens: 8192 },
  { id: 'chatgpt', name: 'HotPlug ChatGPT', api: 'openai-completions', reasoning: false, input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 128000, maxTokens: 8192 },
];
c.models.providers.hotplug = hp;
fs.writeFileSync(p, JSON.stringify(c, null, 2));
console.log(JSON.stringify({ primary: c.agents.defaults.model.primary, baseUrl: hp.baseUrl, key: hp.apiKey.slice(0,15)+'...', models: hp.models.map(m => m.id) }, null, 2));
NODE"

echo "=== restart stack ==="
bash /data/data/com.termux/files/home/start-stack.sh
