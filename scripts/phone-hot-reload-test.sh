#!/usr/bin/env bash
set -euo pipefail
export PATH="/data/data/com.termux/files/usr/bin:$PATH"
PD=/data/data/com.termux/files/usr/bin/proot-distro
H=/data/data/com.termux/files/home

$PD login ubuntu -- bash -lc 'cd /root/hotplug && git pull && npm run build >/dev/null'
$PD login ubuntu -- bash -lc 'pkill -f "node scripts/start.js" 2>/dev/null || true; pkill -f chrome-headless-shell 2>/dev/null || true; pkill -f "chrome-linux" 2>/dev/null || true; fuser -k 8787/tcp 2>/dev/null || true; exit 0'
sleep 3
nohup $PD login ubuntu -- bash -lc '/root/start-hotplug.sh' >> "$H/hotplug.log" 2>&1 &
for i in $(seq 1 20); do curl -sf http://127.0.0.1:8787/api/health >/dev/null && break; sleep 2; done
curl -sf http://127.0.0.1:8787/api/health >/dev/null || { echo fail; exit 1; }
echo "HotPlug reloaded"
# keep tunnel if healthy, else restart
curl -sf -o /dev/null https://hotplug.xankiiza.com/api/health || bash "$H/phone-restart-tunnel.sh"
bash "$H/phone-test-chat.sh"
