#!/usr/bin/env bash
export PATH="/data/data/com.termux/files/usr/bin:$PATH"
PD=/data/data/com.termux/files/usr/bin/proot-distro

echo "=== openclaw binary ==="
$PD login ubuntu -- bash -lc 'which openclaw; openclaw --version 2>&1 | head -3'

echo "=== port 18789 ==="
curl -v --max-time 5 http://127.0.0.1:18789/ 2>&1 | tail -15

echo "=== try foreground start 15s ==="
timeout 15 $PD login ubuntu -- bash -lc 'openclaw gateway --bind loopback --port 18789' 2>&1 | tail -30 || true

echo "=== log file ==="
tail -30 /data/data/com.termux/files/home/openclaw-gateway.log 2>/dev/null || echo empty
