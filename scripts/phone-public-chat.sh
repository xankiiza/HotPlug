#!/usr/bin/env bash
set -euo pipefail
KEY=hp_1fDhnmvUD4C_j-fVVzl44asYt7TdFOaT
echo "=== public stream ==="
out=$(curl -sf -N -m 150 -X POST https://hotplug.xankiiza.com/v1/chat/completions \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gemini","messages":[{"role":"user","content":"Reply with exactly: ok"}],"stream":true}' || true)
echo "$out" | head -c 1500
echo
if echo "$out" | grep -qi '"content":"ok"'; then echo PUBLIC_OK; else echo PUBLIC_FAIL; fi
curl -sf -o /dev/null -w "hotplug:%{http_code}\n" https://hotplug.xankiiza.com/api/health
curl -sf -o /dev/null -w "max:%{http_code}\n" https://max.xankiiza.com/
# ensure openclaw up
if ! curl -sf http://127.0.0.1:18789/ >/dev/null; then
  bash /data/data/com.termux/files/home/phone-bringup.sh || true
fi
