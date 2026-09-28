#!/usr/bin/env bash
echo "=== local ==="
curl -sf -o /dev/null -w "hotplug local: %{http_code}\n" http://127.0.0.1:8787/api/health || echo "hotplug local: fail"
curl -sf -o /dev/null -w "openclaw local: %{http_code}\n" http://127.0.0.1:18789/ || echo "openclaw local: fail"

echo "=== public ==="
curl -sf -o /dev/null -w "hotplug public: %{http_code}\n" https://hotplug.xankiiza.com/api/health || echo "hotplug public: fail"
curl -sf -o /dev/null -w "max public: %{http_code}\n" https://max.xankiiza.com/ || echo "max public: fail"

echo "=== cloudflared ==="
ps aux | grep cloudflared | grep -v grep || echo "cloudflared not running"
tail -5 /data/data/com.termux/files/home/stack.log 2>/dev/null || true
grep -c "Registered tunnel connection" /data/data/com.termux/files/home/stack.log 2>/dev/null || echo "0 tunnel registrations in stack.log"
