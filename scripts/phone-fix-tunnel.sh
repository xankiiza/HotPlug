#!/usr/bin/env bash
set -euo pipefail
export PATH="/data/data/com.termux/files/usr/bin:$PATH"
PD=/data/data/com.termux/files/usr/bin/proot-distro
H=/data/data/com.termux/files/home

bash "$H/phone-cleanup.sh"

$PD login ubuntu -- bash -lc 'cp /root/hotplug/scripts/start-services.sh /root/start-services.sh 2>/dev/null || cp '"$H"'/start-services.sh /root/start-services.sh; chmod +x /root/start-services.sh'

chmod +x "$H/start-stack.sh" "$H/phone-cleanup.sh"
bash "$H/start-stack.sh"

echo "=== verify public ==="
sleep 5
curl -sf -o /dev/null -w "max: %{http_code}\n" https://max.xankiiza.com/ || echo "max: fail"
curl -sf -o /dev/null -w "hotplug: %{http_code}\n" https://hotplug.xankiiza.com/api/health || echo "hotplug: fail"
