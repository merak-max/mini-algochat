# Mini AlgoChat

Mini AlgoChat is a Vite + React chatbot frontend with a small Express backend that calls an OpenAI-compatible API through the official `openai` SDK.

Live frontend:

- https://merak-max.github.io/mini-algochat/

## Important deployment note

GitHub Pages is static hosting only. It can serve the Vite-built React files from `dist`, but it cannot run `server.js`, keep environment variables secret, or call the OpenAI SDK securely by itself.

The production setup is therefore:

1. GitHub Pages hosts the frontend.
2. A separate Node hosting provider runs `server.js`.
3. The frontend calls that backend through `VITE_API_BASE_URL`.
4. OpenAI or Bifrost API keys stay only on the backend host.

Do not put real API keys in React code, `VITE_*` variables, GitHub Pages, or committed files.

## Run the frontend locally

Install dependencies:

```bash
npm ci
```

Create a local env file:

```bash
cp .env.example .env
```

For local frontend development, set:

```bash
VITE_API_BASE_URL=http://localhost:8787
```

Start the Vite frontend:

```bash
npm run client
```

Open:

```text
http://localhost:5173/mini-algochat/
```

## Run the backend locally

Add server-only values to `.env`:

```bash
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_BASE_URL=https://your-openai-compatible-base-url.example/v1
OPENAI_MODEL=your-model-name
PORT=8787
FRONTEND_ORIGIN=http://localhost:5173
```

Then run:

```bash
npm run server
```

Test the backend directly:

```bash
curl http://localhost:8787/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"sender":"user","text":"Say hello"}]}'
```

## Run frontend and backend together

```bash
npm run dev
```

The frontend uses `VITE_API_BASE_URL` for `/api/chat` and `/api/advice`. If `VITE_API_BASE_URL` is missing in a static build, the UI still loads and shows a friendly backend-not-configured message when chat is used.

## Build and preview production frontend

```bash
npm run build
npm run preview
```

The Vite production build is written to `dist`. The GitHub Actions workflow deploys exactly `./dist` to GitHub Pages.

## Set `VITE_API_BASE_URL` for production

When the backend is deployed, add this variable to the GitHub Actions build environment or repository variables:

```bash
VITE_API_BASE_URL=https://your-backend-host.example.com
```

This URL is public and safe to expose. It must be the URL of your own backend, not an OpenAI or Bifrost API URL.

## Simplest backend hosting option

For this project, the simplest backend hosting option is Render Web Service:

- Build command: `npm ci`
- Start command: `npm run server`
- Environment variables: `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`, `FRONTEND_ORIGIN`

After Render gives you a URL, set `VITE_API_BASE_URL` to that Render URL and redeploy GitHub Pages.

Railway or Fly.io also work, but Render is the fastest path for a small Express backend.
