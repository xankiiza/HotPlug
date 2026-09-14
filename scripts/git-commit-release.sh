#!/usr/bin/env bash
set -euo pipefail
cd "/mnt/c/Users/Kiiza Christian/Desktop/Dev/Others/HotPlug"

git add README.md server/ src/ test/ Dockerfile docker-compose.yml scripts/
git status --short

git commit -m "$(cat <<'EOF'
Add Termux deploy scripts, Browserless support, and production docs.

Includes Playwright Chromium install with system deps, Cloudflare tunnel
setup, OpenClaw provisioning, Docker compose, and a unified start-stack
boot script for the home server.
EOF
)"

git push origin main
