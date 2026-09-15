#!/usr/bin/env bash
set -euo pipefail
export PATH="/data/data/com.termux/files/usr/bin:$PATH"
PD=/data/data/com.termux/files/usr/bin/proot-distro

echo "=== pull + build HotPlug ==="
$PD login ubuntu -- bash -lc 'cd /root/hotplug && git pull && npm run build'

echo "=== configure OpenClaw for HotPlug ==="
$PD login ubuntu -- bash -lc 'cd /root/hotplug && node scripts/configure-openclaw-hotplug.mjs'

echo "=== restart stack ==="
bash /data/data/com.termux/files/home/start-stack.sh

echo "=== health check ==="
sleep 8
curl -sf http://127.0.0.1:8787/api/health | head -c 400
echo
curl -sf http://127.0.0.1:8787/v1/models -H "Authorization: Bearer hp_1fDhnmvUD4C_j-fVVzl44asYt7TdFOaT" | head -c 400
echo
