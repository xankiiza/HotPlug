#!/usr/bin/env bash
set -euo pipefail
KEY="${1:-hp_1fDhnmvUD4C_j-fVVzl44asYt7TdFOaT}"
echo "=== local gemini stream ==="
out=$(curl -sf -N -m 150 -X POST http://127.0.0.1:8787/v1/chat/completions \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gemini","messages":[{"role":"user","content":"Reply with exactly: pong"}],"stream":true}' || true)
echo "$out" | head -c 2000
echo
if echo "$out" | grep -q 'pong\|Pong'; then echo LOCAL_OK; else echo LOCAL_FAIL; fi
echo "=== public ==="
curl -sf -o /dev/null -w "hotplug:%{http_code} max:%{http_code}\n" https://hotplug.xankiiza.com/api/health https://max.xankiiza.com/ || true
