# Development

## Install

Run:

```bash
npm install
```

If the browser smoke test has not been run on this machine before, install Chromium for Playwright:

```bash
npx playwright install chromium
```

## Run Tests

```bash
npm test
npm run lint
npm run build
npm run test:e2e
```

For a headless or restricted environment, run the smoke test with:

```bash
MEMORA_E2E_HEADLESS=1 npm run test:e2e
```

If the machine cannot write to the default Playwright browser cache, use a writable browser path
for both install and test runs:

```bash
PLAYWRIGHT_BROWSERS_PATH=/tmp/memora-playwright-browsers npx playwright install chromium
PLAYWRIGHT_BROWSERS_PATH=/tmp/memora-playwright-browsers npm run test:e2e
```

## Seed Local Invite Code

Start the API with mock AI:

```bash
AI_PROVIDER=mock DATABASE_PATH=data/ai-learning.sqlite npm run dev --workspace @memora/api
```

The API automatically ensures one unlimited main invite code exists. By default it is:

```text
MEMORA-MAIN
```

To use a different main invite code, set:

```bash
MEMORA_MAIN_INVITE_CODE=your-main-code
```

Create a private beta code:

```bash
INVITE_CODE=BETA-001 npm run seed:invite --workspace @memora/api
```

Each regular invite starts with 20 memory potions.

## Run Extension Locally

Build:

```bash
npm run build --workspace @memora/extension
```

Open Chrome Extensions, enable developer mode, choose "Load unpacked", and select:

```text
apps/extension/dist
```

## Local API

The extension reads the backend URL from `VITE_API_BASE_URL` at build time. If it is not set,
the extension uses:

```text
http://localhost:8787
```

## Production AI

The backend owns model credentials. Set these environment variables on the backend host:

```bash
AI_PROVIDER=openai
DATABASE_PATH=data/ai-learning.sqlite
```

Add `OPENAI_API_KEY` and `OPENAI_MODEL` as secret values in the hosting provider's environment
settings. `OPENAI_MODEL` must be a Responses API model that supports structured JSON Schema output.

The extension never stores AI provider credentials.

## DeepSeek AI

For local or production DeepSeek testing, run the backend with:

```bash
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=your-secret-key
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_BASE_URL=https://api.deepseek.com
DATABASE_PATH=data/ai-learning.sqlite
```

DeepSeek credentials stay on the backend. Do not put them into extension code or Vite variables.
