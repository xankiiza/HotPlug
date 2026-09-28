#!/usr/bin/env bash
export PATH="/data/data/com.termux/files/usr/bin:$PATH"
PD=/data/data/com.termux/files/usr/bin/proot-distro
echo "=== termux hotplug.log ==="
tail -50 /data/data/com.termux/files/home/hotplug.log 2>/dev/null || echo none
echo "=== ubuntu hotplug.log ==="
$PD login ubuntu -- bash -lc 'tail -50 /root/hotplug.log 2>/dev/null; echo ---; ps aux | egrep "node scripts|chrome-headless|openclaw|cloudflared" | grep -v grep'
