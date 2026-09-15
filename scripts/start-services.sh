#!/usr/bin/env bash
# Run HotPlug, OpenClaw, and cloudflared in one proot Ubuntu session (Termux).
set -euo pipefail

pkill -f 'openclaw gateway' 2>/dev/null || true
pkill -f 'node scripts/start.js' 2>/dev/null || true
pkill -f 'chrome-headless-shell' 2>/dev/null || true
pkill -f 'ms-playwright/chromium' 2>/dev/null || true
fuser -k 8787/tcp 18789/tcp 2>/dev/null || true
sleep 2

mkdir -p /var/tmp/openclaw-compile-cache
export NODE_COMPILE_CACHE=/var/tmp/openclaw-compile-cache
export OPENCLAW_NO_RESPAWN=1

echo "[stack] starting OpenClaw (slow on first boot)..."
/usr/bin/openclaw gateway --bind loopback --port 18789 >> /root/openclaw.log 2>&1 &
sleep 5

echo "[stack] starting HotPlug..."
bash /root/start-hotplug.sh >> /root/hotplug.log 2>&1 &
sleep 5

hp_ok=0; oc_ok=0
for i in $(seq 1 90); do
  curl -sf http://127.0.0.1:8787/api/health >/dev/null && hp_ok=1
  curl -sf http://127.0.0.1:18789/ >/dev/null && oc_ok=1
  if [ "$hp_ok" = 1 ] && [ "$oc_ok" = 1 ]; then
    echo "[stack] HotPlug and OpenClaw ready (${i}x2s)"
    break
  fi
  [ $((i % 10)) -eq 0 ] && echo "[stack] waiting... hotplug=$hp_ok openclaw=$oc_ok (${i}x2s)"
  sleep 2
done

if [ "$hp_ok" != 1 ]; then echo "[stack] HotPlug failed"; tail -20 /root/hotplug.log; exit 1; fi
if [ "$oc_ok" != 1 ]; then echo "[stack] OpenClaw failed"; tail -40 /root/openclaw.log; ps aux | grep openclaw | grep -v grep || true; exit 1; fi

echo "[stack] starting cloudflared..."
exec cloudflared tunnel --protocol http2 run max-homeserver
