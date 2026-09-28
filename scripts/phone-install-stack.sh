#!/usr/bin/env bash
set -euo pipefail
export PATH="/data/data/com.termux/files/usr/bin:$PATH"
PD=/data/data/com.termux/files/usr/bin/proot-distro
TERMUX=/data/data/com.termux/files/home

cp "$TERMUX/start-services.sh" /root/start-services.sh 2>/dev/null || true
$PD login ubuntu -- bash -lc 'cp /root/hotplug/scripts/start-services.sh /root/start-services.sh && chmod +x /root/start-services.sh'
cp "$TERMUX/start-stack.sh" "$TERMUX/start-stack.sh"
chmod +x "$TERMUX/start-stack.sh" /root/start-services.sh 2>/dev/null || true
bash "$TERMUX/start-stack.sh"
