#!/usr/bin/env bash
set -euo pipefail
export PATH="/data/data/com.termux/files/usr/bin:$PATH"
PD=/data/data/com.termux/files/usr/bin/proot-distro
H=/data/data/com.termux/files/home

echo "=== restart cloudflared ==="
$PD login ubuntu -- bash -lc 'pkill -f "cloudflared tunnel" 2>/dev/null || true; exit 0'
sleep 2
: > "$H/cloudflared.log"
nohup $PD login ubuntu -- bash -lc 'exec cloudflared tunnel --protocol http2 run max-homeserver' > "$H/cloudflared.log" 2>&1 &

for i in $(seq 1 30); do
  if grep -q "Registered tunnel connection" "$H/cloudflared.log" 2>/dev/null; then
    echo "Tunnel registered"
    break
  fi
  sleep 2
done
sleep 3
tail -8 "$H/cloudflared.log"
echo "=== public ==="
curl -sf -o /dev/null -w "hotplug: %{http_code}\n" https://hotplug.xankiiza.com/api/health || echo "hotplug: fail"
curl -sf -o /dev/null -w "max: %{http_code}\n" https://max.xankiiza.com/ || echo "max: fail"
