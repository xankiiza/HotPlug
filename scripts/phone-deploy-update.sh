#!/usr/bin/env bash
set -euo pipefail
export PATH="/data/data/com.termux/files/usr/bin:$PATH"
PD=/data/data/com.termux/files/usr/bin/proot-distro
H=/data/data/com.termux/files/home

$PD login ubuntu -- bash -lc 'cd /root/hotplug && git pull && npm run build'
bash "$H/phone-fix-tunnel.sh"
