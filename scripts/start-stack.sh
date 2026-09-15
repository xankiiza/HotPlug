#!/data/data/com.termux/files/usr/bin/bash
# Boot HotPlug + OpenClaw + Cloudflare tunnel in ONE proot Ubuntu session.
set -euo pipefail
export PATH="/data/data/com.termux/files/usr/bin:$PATH"
PD=/data/data/com.termux/files/usr/bin/proot-distro
TERMUX_HOME="/data/data/com.termux/files/home"

echo "Stopping stale proot sessions..."
for pid in $(ps aux | grep '/proot ' | grep -v grep | awk '{print $2}'); do
  kill -9 "$pid" 2>/dev/null || true
done
sleep 4

echo "Starting stack (single proot)..."
nohup $PD login ubuntu -- bash -lc '/root/start-services.sh' > "$TERMUX_HOME/stack.log" 2>&1 &

for i in $(seq 1 60); do
  hp=0; oc=0; tun=0
  curl -sf http://127.0.0.1:8787/api/health >/dev/null && hp=1
  curl -sf http://127.0.0.1:18789/ >/dev/null && oc=1
  grep -q "Registered tunnel connection" "$TERMUX_HOME/stack.log" 2>/dev/null && tun=1
  if [ "$hp" = 1 ] && [ "$oc" = 1 ] && [ "$tun" = 1 ]; then
    echo "Stack OK (HotPlug + OpenClaw + tunnel)"
    exit 0
  fi
  [ $((i % 10)) -eq 0 ] && echo "waiting stack... hp=$hp oc=$oc tun=$tun (${i}x3s)"
  sleep 3
done

echo "Stack incomplete — check stack.log"
tail -30 "$TERMUX_HOME/stack.log" 2>/dev/null || true
$PD login ubuntu -- bash -lc 'tail -20 /root/openclaw.log 2>/dev/null; tail -10 /root/hotplug.log 2>/dev/null' || true
exit 1
