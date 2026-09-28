#!/usr/bin/env bash
set -euo pipefail
export PATH="/data/data/com.termux/files/usr/bin:$PATH"
PD=/data/data/com.termux/files/usr/bin/proot-distro
H=/data/data/com.termux/files/home

echo "=== pull HotPlug ==="
$PD login ubuntu -- bash -lc 'cd /root/hotplug && git pull && npm run build'

echo "=== restart HotPlug process only ==="
$PD login ubuntu -- bash -lc '
  pkill -f "node scripts/start.js" 2>/dev/null || true
  fuser -k 8787/tcp 2>/dev/null || true
  sleep 2
  nohup /root/start-hotplug.sh >> /root/hotplug.log 2>&1 &
  exit 0
'
# Note: if HotPlug was started inside start-services.sh, killing node there may leave orphan.
# Prefer starting a dedicated hotplug if port free.

for i in $(seq 1 20); do
  curl -sf http://127.0.0.1:8787/api/health >/dev/null && echo "HotPlug OK" && break
  sleep 2
done
curl -sf http://127.0.0.1:8787/api/health >/dev/null || { echo "HotPlug still down — full stack restart"; bash "$H/phone-fix-tunnel.sh"; }

echo "=== ensure tunnel ==="
if ! curl -sf -o /dev/null https://hotplug.xankiiza.com/api/health; then
  $PD login ubuntu -- bash -lc 'pkill -f "cloudflared tunnel" 2>/dev/null || true; exit 0'
  sleep 1
  nohup $PD login ubuntu -- bash -lc 'exec cloudflared tunnel --protocol http2 run max-homeserver' > "$H/cloudflared.log" 2>&1 &
  sleep 8
fi
curl -sf -o /dev/null -w "public: %{http_code}\n" https://hotplug.xankiiza.com/api/health || echo "public: fail"
