# Change log

## 2026-09-13 — Public repository polish

- Reframed the README around the product, its architecture, verified capabilities and public frontend limitations.
- Added a current desktop application screenshot and a Mermaid request-flow diagram.
- Added GitHub Actions continuous integration for unit/integration tests, the production build and Playwright browser tests.
- Updated the Pages workflow to run the verified test-and-build command before deployment.
- Verification: 16 Node.js tests, 11 Playwright tests, production build and `git diff --check` passed.

## 2026-09-11 — GitHub checkpoint

- User authorized committing and pushing the completed project work on `improve/local-chat-foundation`; no merge to `main` or deployment requested.
- Local `.env`, installed dependencies, build output and browser-test artifacts are excluded from the commit.
- Commit uses this repository's existing merak-max author identity via command-local Git options, leaving shared Git settings unchanged.
- Earlier "not committed/pushed" notes below describe the state at those earlier checkpoints.

## 2026-09-11 — Scoped keyless Bifrost integration

- Changed only `server.js`, `.env.example`, the backend regression tests, this log and the related README note; added a Git-ignored local `.env` with mode 0600 and no secrets. No UI, dependency or Bifrost changes.
- Added explicit `OPENAI_ALLOW_KEYLESS=true` support requiring `OPENAI_BASE_URL`. The SDK constructor placeholder is not transmitted: Authorization is explicitly omitted, including when a shell API key is present. Default keyed behavior is retained.
- Local app uses the previously tested private Bifrost `/v1` endpoint and `openai/gpt-5.2`, with loopback-only serving.
- Verification: 16 backend/state tests, 11 browser regression tests, and production build passed. New tests verify missing Authorization and opt-in/URL requirements.
- Also verified the real browser → Mini AlgoChat backend → SDK → Bifrost path with two short actual inference requests. Replies: "Hi—welcome to Mini AlgoChat!" and "Mini AlgoChat" for the follow-up. UI reported "AI reply verified this session". These were not mocked calls.
- Temporary browser/server closed after verification. No push, deployment, shared authentication change or key rotation.

## 2026-09-11 — Direct Bifrost inference verified without a key

- With explicit user authorization, sent two short Responses API requests to the private Bifrost endpoint without any authorization header.
- Requested `openai/gpt-5.2`; returned model was `gpt-5.2-2025-12-11`. Both requests returned HTTP 200.
- First reply: "Hi—welcome to Mini AlgoChat!" Follow-up correctly recalled "Mini AlgoChat" from the supplied conversation history.
- Reported usage: 36 tokens for the first request and 61 for the follow-up (97 total). These were real inference calls, not simulated tests; monetary cost was not determined.
- This verifies Bifrost directly, not the app UI. Mini AlgoChat still requires a key in its current server configuration; a scoped explicit keyless-gateway option remains to be implemented before app-level verification.
- No gateway settings, authentication enforcement, keys, deployment or app configuration changed during this check.

## 2026-09-11 — Bifrost connection check (blocked)

- User selected the existing gateway in `/opt/docker/bifrost` for AI requests.
- Read stack operating instructions and inspected only relevant configuration; no gateway files, containers, databases or credentials changed.
- Private gateway health returned `status: ok`.
- Confirmed the current environment's `BIFROST_API_KEY` matches the stack `.env` value without displaying either secret.
- Authenticated model-list requests to both `https://bifrost.shau.me/v1/models` and the direct private gateway returned HTTP 401: virtual key not found or revoked. Both Bearer and `x-bf-vk` authentication were rejected at the public endpoint.
- No inference requests or paid AI calls were made. No key was copied into this project, and the app configuration was left unchanged rather than saved with a known-rejected credential.
- Next step: obtain a valid Bifrost virtual key through the gateway owner/admin, configure it privately, then verify a model and a short real conversation. Do not rotate shared credentials without explicit authorization.

## 2026-09-11 — Local chat foundation (unreleased)

Branch: `improve/local-chat-foundation`.
Starting commit: `db8ce653b578194f63b2d5f3f4411cdfdd5824b0`.

### Scope and safety

- Worked only in `/home/ec2-user/Developer/mini-algochat`, cloned from `merak-max/mini-algochat`.
- Kept the React + Express architecture, existing palette and conversation features. Did not copy another project's source.
- No push, pull request, merge, deployment, shared server configuration change or credential reuse.
- No `.env` or real API key created. No paid AI call made. Real-provider verification remains blocked on private project configuration.

### Changes by area

| Files | Change and reason |
| --- | --- |
| `server.js` | Separate app creation from startup for tests; honest configuration health; remove fake AI fallback; validate requests; bounded provider calls; safe errors; JSON API 404s; explicit cross-origin configuration; loopback default |
| `shared/chat.js` | Single set of message/context limits used in browser and server |
| `src/api.js` | Relative same-origin API calls by default; HTTP/non-JSON/network/timeout error handling |
| `src/chat-state.js` | Validate saved history while preserving older numeric IDs; unique new IDs; exclude welcome/error/advice messages from AI context |
| `src/App.jsx` | Actual backend status; per-chat failures and retry; protect storage errors; prevent duplicate in-flight sends; target replies to the original conversation; hide introduction after chat begins; mobile navigation; composition-aware Enter handling |
| `src/MessageContent.jsx` | Markdown, fenced code and copying using `react-markdown`; no raw HTML or automatic remote images |
| `src/App.css`, `src/index.css` | Remove conflicting starter styles; contain long messages/code; keep composer within viewport; mobile sidebar; focus and reduced-motion support |
| `vite.config.js` | Loopback-only frontend with strict port and reliable local backend proxy |
| `.env.example` | Empty key/URL placeholders; explicit local defaults and Responses compatibility note |
| `.gitignore` | Ignore additional local env files and browser-test artifacts, preserving tracked `.env.example` |
| `render.yaml` | Preserve existing hosting compatibility by explicitly setting non-local bind address in the blueprint; nothing deployed |
| `package.json`, `package-lock.json` | Add test/check scripts, coupled dev-process shutdown, React Markdown and Playwright; replace `latest` specs with bounded major ranges; compatible audit fixes |
| `test/`, `playwright.config.js` | Node backend/state tests and Chromium browser tests; local-only provider simulation, no external AI credentials |
| `README.md` | Beginner-friendly local setup, file map, private credential steps, tests, and future-hosting warnings |

`react-markdown` is the only new runtime dependency; Playwright is development-only. No framework migration, database, account system, agent framework or new hosting service was added.

### Verification

- Baseline production build passed before changes; baseline dependency audit reported 7 advisories.
- `npm run check`: 14 backend/state tests passed and the production build passed.
- `npm run test:e2e`: 11 Chromium browser tests passed (25 automated tests in total).
- `git diff --check`: passed.
- Browser integration uses a labelled simulated provider through the actual OpenAI SDK. A real AI conversation is **not verified**.
- Manual local startup confirmed Vite → Express health and an honest HTTP 503 setup response with no key.
- Dependency audit after compatible fixes: 0 reported advisories (not a guarantee of overall security).
- Mobile/desktop checks cover 320, 390, 768 and 1280px widths; browser tests check conversation persistence, retry and pending-reply ownership.
- Temporary development/test servers stopped after verification. Local dependencies, `dist/` and ignored test screenshots remain available in this project directory.

### Remaining work

1. Privately configure the project's chosen provider/key/model and verify a short real conversation and follow-up.
2. Review the local UI together; collect any style/usability changes before broadening scope.
3. Consider cancellation/streaming, history export and additional accessibility checks in later sessions.
4. Before any public hosting: agree access control, rate limits, spending safeguards, production logging and deployment configuration.

### Reviewing this work

Use `git status --short` and `git diff` for tracked edits. New files are listed by `git status` and in the table above. Nothing has been pushed; `main` stays at the original commit. Generated dependencies, builds and test output are ignored rather than committed.
