#!/usr/bin/env bash
export PATH="/data/data/com.termux/files/usr/bin:$PATH"
PD=/data/data/com.termux/files/usr/bin/proot-distro

echo "=== kill all proots ==="
for pid in $(ps aux | grep '/proot ' | grep -v grep | awk '{print $2}'); do kill -9 "$pid" 2>/dev/null || true; done
pkill -f phone-read-openclaw 2>/dev/null || true
sleep 3

echo "=== kill orphans inside ubuntu ==="
$PD login ubuntu -- bash -lc '
  pkill -f chrome 2>/dev/null || true
  pkill -f chromium 2>/dev/null || true
  pkill -f playwright 2>/dev/null || true
  pkill -f openclaw 2>/dev/null || true
  pkill -f cloudflared 2>/dev/null || true
  pkill -f "node scripts/start" 2>/dev/null || true
  fuser -k 8787/tcp 18789/tcp 2>/dev/null || true
  exit 0
'
sleep 2
echo "cleanup done"
