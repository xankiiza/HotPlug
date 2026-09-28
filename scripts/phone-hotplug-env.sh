#!/usr/bin/env bash
export PATH="/data/data/com.termux/files/usr/bin:$PATH"
PD=/data/data/com.termux/files/usr/bin/proot-distro
$PD login ubuntu -- bash -lc '
echo "=== start-hotplug.sh ==="
cat /root/start-hotplug.sh
echo "=== hotplug env of running node ==="
tr "\0" "\n" < /proc/$(pgrep -f "node scripts/start.js" | head -1)/environ 2>/dev/null | egrep "HOTPLUG|DISPLAY|PORT|NODE" || echo "no environ"
echo "=== last hotplug log ==="
tail -30 /root/hotplug.log 2>/dev/null
tail -30 /data/data/com.termux/files/home/hotplug.log 2>/dev/null
'
