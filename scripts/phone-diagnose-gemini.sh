#!/usr/bin/env bash
export PATH="/data/data/com.termux/files/usr/bin:$PATH"
/data/data/com.termux/files/usr/bin/proot-distro login ubuntu -- bash -lc '
export HOTPLUG_DATA_DIR=/root/hotplug-data
export HOTPLUG_HEADLESS=true
export DISPLAY=:99
if ! pgrep -x Xvfb >/dev/null 2>&1; then Xvfb :99 -screen 0 1400x900x24 >/dev/null 2>&1 & sleep 1; fi
cd /root/hotplug
node <<'"'"'NODE'"'"'
import { ProviderSessionManager } from "./server/provider-sessions.js";
const s = new ProviderSessionManager("/root/hotplug-data");
try {
  const d = await s.diagnose("gemini", "say hi");
  console.log(JSON.stringify({
    url: d.url,
    title: d.title,
    elements: d.elements?.slice(0, 10),
    buttons: d.buttons?.filter(b => /send|submit|ask|continue|agree|accept|got it/i.test(`${b.ariaLabel} ${b.text} ${b.title}`)).slice(0, 20),
    allButtonsTail: d.buttons?.slice(-12),
    responses: d.responses?.slice(-10),
  }, null, 2));
} catch (e) {
  console.error("DIAG_FAIL", e.message);
} finally {
  await s.close().catch(() => {});
}
NODE
'
