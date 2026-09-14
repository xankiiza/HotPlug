#!/usr/bin/env bash
set -euo pipefail
export PATH="/data/data/com.termux/files/usr/bin:$PATH"
PD=/data/data/com.termux/files/usr/bin/proot-distro
TERMUX_HOME="/data/data/com.termux/files/home"

# proot-distro copy fails while services run; termux home is bind-mounted in proot.
cp "$TERMUX_HOME/deploy-termux.sh" "$TERMUX_HOME/deploy-hotplug.sh"
$PD login ubuntu -- bash -lc "cp '$TERMUX_HOME/deploy-hotplug.sh' /root/deploy-hotplug.sh && bash /root/deploy-hotplug.sh"
