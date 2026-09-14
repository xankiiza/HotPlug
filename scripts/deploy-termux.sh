#!/usr/bin/env bash
set -euo pipefail

REPO="${1:-https://github.com/xankiiza/HotPlug.git}"
INSTALL_DIR="/root/hotplug"
DATA_DIR="/root/hotplug-data"

export DEBIAN_FRONTEND=noninteractive

apt-get update -qq
apt-get install -y -qq git curl ca-certificates \
  libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 libgbm1 libasound2 \
  libxshmfence1 libgtk-3-0 libx11-xcb1 libxdamage1 libxfixes3 libxrandr2 \
  fonts-liberation xvfb >/dev/null 2>&1 || true

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
fi

echo "node $(node -v) npm $(npm -v) arch $(uname -m)"

if [ -d "$INSTALL_DIR/.git" ]; then
  git -C "$INSTALL_DIR" pull --ff-only
else
  rm -rf "$INSTALL_DIR"
  git clone "$REPO" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"
npm ci
npx playwright install chromium
npx playwright install-deps chromium
npm run build

mkdir -p "$DATA_DIR/profiles"
export HOTPLUG_DATA_DIR="$DATA_DIR"
export HOTPLUG_HOST="127.0.0.1"
export HOTPLUG_PUBLIC_HOST="${HOTPLUG_PUBLIC_HOST:-hotplug.xankiiza.com}"
export PORT="8787"
export NODE_ENV="production"
export HOTPLUG_HEADLESS="true"

if [ -f /data/data/com.termux/files/home/provision-openclaw.mjs ]; then
  cp /data/data/com.termux/files/home/provision-openclaw.mjs scripts/provision-openclaw.mjs
fi
node scripts/provision-openclaw.mjs

cat > /root/start-hotplug.sh <<'START'
#!/usr/bin/env bash
# Virtual display for provider sign-in (view via phone VNC if needed)
if ! pgrep -x Xvfb >/dev/null 2>&1; then
  Xvfb :99 -screen 0 1400x900x24 >/dev/null 2>&1 &
  sleep 1
fi
export DISPLAY=:99

export HOTPLUG_DATA_DIR="/root/hotplug-data"
export HOTPLUG_HOST="127.0.0.1"
export HOTPLUG_PUBLIC_HOST="${HOTPLUG_PUBLIC_HOST:-hotplug.xankiiza.com}"
export PORT="8787"
export NODE_ENV="production"
export HOTPLUG_HEADLESS="true"

# Optional: remote sign-in from hotplug.xankiiza.com/admin (Browserless LiveURL)
# export HOTPLUG_BROWSERLESS_TOKEN=your_token
# export HOTPLUG_BROWSERLESS_ORIGIN=https://production-sfo.browserless.io

cd /root/hotplug
exec node scripts/start.js
START
chmod +x /root/start-hotplug.sh

cp "$INSTALL_DIR/scripts/start-stack.sh" /data/data/com.termux/files/home/start-stack.sh
cp "$INSTALL_DIR/scripts/start_openclaw.sh" /data/data/com.termux/files/home/start_openclaw.sh
chmod +x /data/data/com.termux/files/home/start-stack.sh /data/data/com.termux/files/home/start_openclaw.sh

echo "HotPlug installed at $INSTALL_DIR"
echo "Data dir: $DATA_DIR"
echo "Boot on Termux: bash ~/start-stack.sh"
