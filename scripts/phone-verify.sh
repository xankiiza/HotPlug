#!/usr/bin/env bash
set -euo pipefail
KEY="${1:-hp_1fDhnmvUD4C_j-fVVzl44asYt7TdFOaT}"

echo "=== health ==="
curl -sf http://127.0.0.1:8787/api/health
echo

echo "=== models ==="
curl -sf http://127.0.0.1:8787/v1/models -H "Authorization: Bearer $KEY"
echo

echo "=== stream test (hotplug/gemini) ==="
curl -sf -N -X POST http://127.0.0.1:8787/v1/chat/completions \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"hotplug/gemini","messages":[{"role":"user","content":"Reply with exactly: pong"}],"stream":true}' | head -c 1200
echo

echo "=== openclaw primary model ==="
export PATH="/data/data/com.termux/files/usr/bin:$PATH"
/data/data/com.termux/files/usr/bin/proot-distro login ubuntu -- bash -lc "node -e \"const c=require('/root/.openclaw/openclaw.json'); console.log(c.agents.defaults.model.primary)\""
