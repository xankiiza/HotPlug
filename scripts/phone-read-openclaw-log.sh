#!/usr/bin/env bash
export PATH="/data/data/com.termux/files/usr/bin:$PATH"
/data/data/com.termux/files/usr/bin/proot-distro login ubuntu -- bash -lc '
echo "=== openclaw.log ==="
tail -60 /root/openclaw.log 2>/dev/null || echo empty
echo "=== openclaw doctor ==="
openclaw doctor 2>&1 | tail -30
echo "=== try gateway 20s ==="
timeout 20 openclaw gateway --bind loopback --port 18789 2>&1 | tail -20
'
