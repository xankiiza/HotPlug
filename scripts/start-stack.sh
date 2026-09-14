#!/data/data/com.termux/files/usr/bin/bash
# Boot HotPlug, OpenClaw, and Cloudflare tunnel on Termux (proot Ubuntu).
set -euo pipefail
export PATH="/data/data/com.termux/files/usr/bin:$PATH"
PD=/data/data/com.termux/files/usr/bin/proot-distro
TERMUX_HOME="/data/data/com.termux/files/home"

echo "Stopping stale proot sessions..."
for pid in $(ps aux | grep '/proot ' | grep -v grep | awk '{print $2}'); do
  kill -9 "$pid" 2>/dev/null || true
done
sleep 3

echo "Starting HotPlug..."
nohup $PD login ubuntu -- bash -lc '/root/start-hotplug.sh' > "$TERMUX_HOME/hotplug.log" 2>&1 &
sleep 6
curl -sf http://127.0.0.1:8787/api/health >/dev/null || {
  echo "HotPlug failed to start"
  tail -20 "$TERMUX_HOME/hotplug.log" 2>/dev/null || true
  $PD login ubuntu -- bash -lc 'tail -20 /root/hotplug.log' 2>/dev/null || true
  exit 1
}
echo "HotPlug OK"

echo "Starting OpenClaw..."
nohup $PD login ubuntu -- bash -lc '
  export NODE_COMPILE_CACHE=/var/tmp/openclaw-compile-cache
  export OPENCLAW_NO_RESPAWN=1
  mkdir -p /var/tmp/openclaw-compile-cache
  exec openclaw gateway --bind loopback --port 18789
' > "$TERMUX_HOME/openclaw-gateway.log" 2>&1 &
sleep 8
curl -sf http://127.0.0.1:18789/ >/dev/null && echo "OpenClaw OK" || echo "OpenClaw still starting..."

echo "Starting Cloudflare tunnel..."
nohup $PD login ubuntu -- bash -lc 'exec cloudflared tunnel --protocol http2 run max-homeserver' > "$TERMUX_HOME/cloudflared.log" 2>&1 &
sleep 6
curl -s -m 15 https://hotplug.xankiiza.com/api/config && echo || echo "Tunnel warming up — retry in 30s"
