#!/usr/bin/env bash
set -euo pipefail
export PATH="/data/data/com.termux/files/usr/bin:$PATH"
PD=/data/data/com.termux/files/usr/bin/proot-distro
TERMUX_HOME="/data/data/com.termux/files/home"

echo "=== kill stale proots ==="
for pid in $(ps aux | grep '/proot ' | grep -v grep | awk '{print $2}'); do
  kill -9 "$pid" 2>/dev/null || true
done
sleep 4

echo "=== free ports inside ubuntu ==="
$PD login ubuntu -- bash -lc 'fuser -k 8787/tcp 18789/tcp 2>/dev/null || true; pkill -f "node scripts/start.js" 2>/dev/null || true; pkill -f openclaw 2>/dev/null || true; pkill -f cloudflared 2>/dev/null || true; exit 0'
sleep 2

echo "=== start HotPlug ==="
nohup $PD login ubuntu -- bash -lc '/root/start-hotplug.sh' > "$TERMUX_HOME/hotplug.log" 2>&1 &
for i in 1 2 3 4 5 6 7 8 9 10; do
  curl -sf http://127.0.0.1:8787/api/health >/dev/null && break
  sleep 2
done
curl -sf http://127.0.0.1:8787/api/health >/dev/null || { echo "HotPlug failed"; tail -15 "$TERMUX_HOME/hotplug.log"; exit 1; }
echo "HotPlug OK"

echo "=== start OpenClaw ==="
nohup $PD login ubuntu -- bash -lc '
  export NODE_COMPILE_CACHE=/var/tmp/openclaw-compile-cache
  export OPENCLAW_NO_RESPAWN=1
  mkdir -p /var/tmp/openclaw-compile-cache
  exec openclaw gateway --bind loopback --port 18789
' > "$TERMUX_HOME/openclaw-gateway.log" 2>&1 &
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  curl -sf http://127.0.0.1:18789/ >/dev/null && break
  sleep 2
done
curl -sf http://127.0.0.1:18789/ >/dev/null && echo "OpenClaw OK" || { echo "OpenClaw failed"; tail -20 "$TERMUX_HOME/openclaw-gateway.log"; exit 1; }

echo "=== start cloudflared ==="
nohup $PD login ubuntu -- bash -lc 'exec cloudflared tunnel --protocol http2 run max-homeserver' > "$TERMUX_HOME/cloudflared.log" 2>&1 &
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  grep -q "Registered tunnel connection" "$TERMUX_HOME/cloudflared.log" 2>/dev/null && break
  sleep 2
done
grep -q "Registered tunnel connection" "$TERMUX_HOME/cloudflared.log" && echo "Tunnel OK" || { echo "Tunnel may still be starting"; tail -15 "$TERMUX_HOME/cloudflared.log"; }

echo "=== public checks ==="
curl -sf -o /dev/null -w "hotplug public: %{http_code}\n" https://hotplug.xankiiza.com/api/health || echo "hotplug public: fail"
curl -sf -o /dev/null -w "max public: %{http_code}\n" https://max.xankiiza.com/ || echo "max public: fail"
