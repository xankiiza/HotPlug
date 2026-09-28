#!/usr/bin/env bash
export PATH="/data/data/com.termux/files/usr/bin:$PATH"
PD=/data/data/com.termux/files/usr/bin/proot-distro
LOG=/data/data/com.termux/files/home/openclaw-gateway.log

$PD login ubuntu -- bash -lc 'pkill -f openclaw 2>/dev/null || true; fuser -k 18789/tcp 2>/dev/null || true; exit 0'
sleep 2

: > "$LOG"
nohup $PD login ubuntu -- bash -lc '
  export NODE_COMPILE_CACHE=/var/tmp/openclaw-compile-cache
  export OPENCLAW_NO_RESPAWN=1
  mkdir -p /var/tmp/openclaw-compile-cache
  exec openclaw gateway --bind loopback --port 18789
' >> "$LOG" 2>&1 &

echo "waiting for openclaw..."
for i in $(seq 1 40); do
  if curl -sf http://127.0.0.1:18789/ >/dev/null; then
    echo "OpenClaw up after ${i}x2s"
    exit 0
  fi
  sleep 2
done

echo "OpenClaw failed to respond"
tail -40 "$LOG"
exit 1
