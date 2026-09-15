#!/usr/bin/env bash
set -euo pipefail
export PATH="/data/data/com.termux/files/usr/bin:$PATH"
PD=/data/data/com.termux/files/usr/bin/proot-distro
H=/data/data/com.termux/files/home

echo "=== start HotPlug if down ==="
if ! curl -sf http://127.0.0.1:8787/api/health >/dev/null; then
  nohup $PD login ubuntu -- bash -lc '/root/start-hotplug.sh' >> "$H/hotplug.log" 2>&1 &
  for i in $(seq 1 20); do
    curl -sf http://127.0.0.1:8787/api/health >/dev/null && break
    sleep 2
  done
fi
curl -sf http://127.0.0.1:8787/api/health >/dev/null && echo "HotPlug OK" || { echo "HotPlug FAIL"; tail -20 "$H/hotplug.log"; exit 1; }

echo "=== start OpenClaw if down ==="
if ! curl -sf http://127.0.0.1:18789/ >/dev/null; then
  nohup $PD login ubuntu -- bash -lc '
    export NODE_COMPILE_CACHE=/var/tmp/openclaw-compile-cache
    export OPENCLAW_NO_RESPAWN=1
    mkdir -p /var/tmp/openclaw-compile-cache
    exec openclaw gateway --bind loopback --port 18789
  ' >> "$H/openclaw-gateway.log" 2>&1 &
  for i in $(seq 1 40); do
    curl -sf http://127.0.0.1:18789/ >/dev/null && break
    sleep 3
  done
fi
curl -sf http://127.0.0.1:18789/ >/dev/null && echo "OpenClaw OK" || echo "OpenClaw still starting"

echo "=== tunnel ==="
bash "$H/phone-restart-tunnel.sh"

echo "=== chat test ==="
bash "$H/phone-test-chat.sh"
