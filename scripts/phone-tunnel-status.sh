#!/usr/bin/env bash
set -euo pipefail
export PATH="/data/data/com.termux/files/usr/bin:$PATH"
PD=/data/data/com.termux/files/usr/bin/proot-distro

echo "=== local ports ==="
curl -sf -o /dev/null -w "hotplug: %{http_code}\n" http://127.0.0.1:8787/api/health || echo "hotplug: DOWN"
curl -sf -o /dev/null -w "openclaw: %{http_code}\n" http://127.0.0.1:18789/ || echo "openclaw: DOWN"

echo "=== proot processes ==="
$PD login ubuntu -- bash -lc 'ps aux | egrep "cloudflared|openclaw|hotplug|node scripts/start" | grep -v grep || true'

echo "=== cloudflared log tail ==="
tail -20 /data/data/com.termux/files/home/cloudflared.log 2>/dev/null || echo "no cloudflared.log"

echo "=== openclaw log tail ==="
tail -20 /data/data/com.termux/files/home/openclaw-gateway.log 2>/dev/null || echo "no openclaw log"

echo "=== hotplug log tail ==="
$PD login ubuntu -- bash -lc 'tail -15 /root/hotplug.log 2>/dev/null || echo no hotplug log'
