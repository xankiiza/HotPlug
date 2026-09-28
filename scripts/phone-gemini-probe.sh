#!/usr/bin/env bash
export PATH="/data/data/com.termux/files/usr/bin:$PATH"
PD=/data/data/com.termux/files/usr/bin/proot-distro
H=/data/data/com.termux/files/home

echo "=== stop HotPlug briefly for exclusive Gemini profile ==="
$PD login ubuntu -- bash -lc 'pkill -f "node scripts/start.js" 2>/dev/null || true; pkill -f chrome-headless-shell 2>/dev/null || true; fuser -k 8787/tcp 2>/dev/null || true; exit 0'
sleep 3

$PD login ubuntu -- bash -lc '
export HOTPLUG_DATA_DIR=/root/hotplug-data
export HOTPLUG_HEADLESS=true
cd /root/hotplug
# pull latest diagnose fix if any
git pull --ff-only >/dev/null 2>&1 || true
node <<'"'"'NODE'"'"'
import { ProviderSessionManager } from "./server/provider-sessions.js";
const s = new ProviderSessionManager("/root/hotplug-data");
try {
  const content = await s.send("gemini", "Reply with exactly: pong");
  console.log("SEND_OK", JSON.stringify(content.slice(0, 500)));
} catch (e) {
  console.error("SEND_FAIL", e.message);
  try {
    const d = await s.diagnose("gemini", "");
    console.log(JSON.stringify({
      url: d.url,
      title: d.title,
      elements: d.elements?.slice(0, 8),
      sendish: d.buttons?.filter(b => /send|submit/i.test(`${b.ariaLabel} ${b.text} ${b.title}`)).slice(0, 15),
      responses: d.responses?.slice(-8),
    }, null, 2));
  } catch (e2) {
    console.error("DIAG_FAIL", e2.message);
  }
} finally {
  await s.close().catch(() => {});
}
NODE
'

echo "=== restart HotPlug ==="
$PD login ubuntu -- bash -lc 'nohup /root/start-hotplug.sh >> /root/hotplug.log 2>&1 & exit 0'
for i in $(seq 1 15); do curl -sf http://127.0.0.1:8787/api/health >/dev/null && echo HotPlug_up && break; sleep 2; done
