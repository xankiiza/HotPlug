#!/usr/bin/env bash
set -euo pipefail
export PATH="/data/data/com.termux/files/usr/bin:$PATH"
PD=/data/data/com.termux/files/usr/bin/proot-distro
H=/data/data/com.termux/files/home
KEY=hp_1fDhnmvUD4C_j-fVVzl44asYt7TdFOaT

echo "=== stop OpenClaw to free RAM ==="
$PD login ubuntu -- bash -lc 'pkill -f openclaw 2>/dev/null || true; exit 0'
pkill -f openclaw 2>/dev/null || true
sleep 2

echo "=== ensure HotPlug ==="
if ! curl -sf http://127.0.0.1:8787/api/health >/dev/null; then
  nohup $PD login ubuntu -- bash -lc '/root/start-hotplug.sh' >> "$H/hotplug.log" 2>&1 &
  sleep 6
fi

echo "=== chat without OpenClaw ==="
curl -sf -N -m 150 -X POST http://127.0.0.1:8787/v1/chat/completions \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gemini","messages":[{"role":"user","content":"Reply with exactly: pong"}],"stream":true}' | head -c 2000
echo
tail -8 "$H/hotplug.log"

echo "=== restart OpenClaw ==="
nohup $PD login ubuntu -- bash -lc '
  export NODE_COMPILE_CACHE=/var/tmp/openclaw-compile-cache
  export OPENCLAW_NO_RESPAWN=1
  mkdir -p /var/tmp/openclaw-compile-cache
  exec openclaw gateway --bind loopback --port 18789
' >> "$H/openclaw-gateway.log" 2>&1 &
echo "OpenClaw starting in background"
