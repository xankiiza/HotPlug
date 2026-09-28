#!/usr/bin/env bash
export PATH="/data/data/com.termux/files/usr/bin:$PATH"
echo "termux: $(which cloudflared 2>/dev/null || echo missing)"
/data/data/com.termux/files/usr/bin/proot-distro login ubuntu -- bash -lc 'which cloudflared; cloudflared --version 2>&1 | head -1'
