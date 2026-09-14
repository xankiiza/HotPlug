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

- Base URL: `http://127.0.0.1:8787/v1`
- API key: the `hp_...` value shown once when a key is created
- Model: `auto` (HotPlug picks the best signed-in provider per request based on speed, reliability, and task fit)

```javascript
baseURL: "http://127.0.0.1:8787/v1"
apiKey: "hp_..."
model: "auto"
```

The API returns standard OpenAI chat completion shapes (`chat.completion`, SSE `chat.completion.chunk`, and `usage` token counts) so OpenClaw and other OpenAI-compatible clients can plug in directly.

For a production-style local run:

```bash
npm run build
npm start
```

The service intentionally binds to `127.0.0.1`. To use it from another machine, place it behind an authenticated private tunnel or reverse proxy; do not expose the browser-session admin routes publicly.
