# HotPlug

HotPlug exposes signed-in AI web chats through a local OpenAI-compatible API. Browser profiles and API-key hashes are stored under `data/`, which is ignored by Git.

## First run

```bash
npm install
npm run install-browser
npm run dev
```

Open the Vite URL, choose **Get Started**, and click **Sign In** beside a provider. Complete sign-in in the Chromium window, leave that window open, and click **Verify**. Use **Test chat** before creating an OpenClaw key.

## OpenClaw

- Base URL: `https://hotplug.xankiiza.com/v1` (production) or `http://127.0.0.1:8787/v1` (local)
- API key: the `hp_...` value shown once when a key is created in the dashboard
- Model: `auto` (HotPlug picks the best signed-in provider per request based on speed, reliability, and task fit)

```javascript
baseURL: "https://hotplug.xankiiza.com/v1"
apiKey: "hp_..."
model: "auto"
```

The API returns standard OpenAI chat completion shapes (`chat.completion`, SSE `chat.completion.chunk`, and `usage` token counts) so OpenClaw and other OpenAI-compatible clients can plug in directly.

For a production-style local run:

```bash
npm run build
npm start
```

### Production (`hotplug.xankiiza.com`)

Set these environment variables on the server:

```bash
HOTPLUG_HOST=0.0.0.0
HOTPLUG_PUBLIC_HOST=hotplug.xankiiza.com
PORT=8787
```

Place the service behind HTTPS (nginx/Caddy) and proxy to port `8787`. The dashboard and API both use the same origin, so OpenClaw only needs the public `/v1` URL and an `hp_...` key.

### Hostinger (Node.js app)

In hPanel → Websites → Node.js, use:

| Setting | Value |
|---------|-------|
| Node version | **20.x** (18+ works) |
| Application root | repository root |
| Build command | `npm run build` |
| Start command | `npm start` |
| Entry file | `server.js` |
| Output directory | leave **empty** (this is a Node app, not a static export) |

Environment variables:

```bash
NODE_ENV=production
HOTPLUG_PUBLIC_HOST=hotplug.xankiiza.com
HOTPLUG_HOST=0.0.0.0
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
```

After the first deploy, SSH in and run `npm run install-browser` if you need provider automation on the server.

If the build log shows `✓ built in …ms` but deployment still fails, the build actually succeeded — check **Runtime Logs** in hPanel for the startup error. Common fixes:

- Leave **Output directory** empty (do not set `dist`)
- Ensure Hostinger injects `PORT` (the app listens on `process.env.PORT`)
- Set `HOTPLUG_HOST=0.0.0.0` and `HOTPLUG_PUBLIC_HOST=hotplug.xankiiza.com`
- Entry file must be `server.js`
