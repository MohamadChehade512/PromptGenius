# PromptGenius

Build better prompts for **Claude**, **ChatGPT** and **Gemini**: live token, cost and context
estimates, plus a 0–100 prompt score with concrete suggestions.

See [PLAN.md](PLAN.md) for the research, the scoring algorithm and the roadmap.

## Getting started

Requirements: **Node 24+** (see `.nvmrc`) and **pnpm** (version pinned in `package.json`).

```sh
# One-time: put pnpm on your PATH via Corepack (ships with Node).
# /usr/local/bin is root-owned on this machine, hence sudo.
sudo corepack enable pnpm

pnpm install
cp .env.example .env.local   # optional until M5; never commit .env.local
pnpm dev                     # web → http://localhost:5173 · API → http://127.0.0.1:8787/api
```

## Scripts

| Command           | What it does                                                      |
| ----------------- | ----------------------------------------------------------------- |
| `pnpm dev`        | Runs the web app and the local API together (Vite proxies `/api`) |
| `pnpm check`      | Format check, lint, typecheck and tests (same as CI)              |
| `pnpm test:watch` | Vitest in watch mode                                              |
| `pnpm build`      | Production build of the web app                                   |
| `pnpm format`     | Formats the repo with Prettier                                    |

## Layout

```
apps/web/               Vite + React + TypeScript SPA (UI only)
packages/core/          Framework-free engine: platforms, estimation, cost, scoring
packages/api-contract/  Zod schemas shared by web and API
services/api/           Hono API: runs on Node locally, deploys to AWS Lambda in Phase 3
infra/                  AWS CDK app (Phase 3)
```

Internal packages export TypeScript source directly (no build step); Vite, tsx and the
future Lambda bundler compile them.

## Security notes

- API keys live only in `.env.local` (git-ignored) and are read only by the API server.
  The browser never receives them.
- The local API binds to `127.0.0.1` only.
- CI runs gitleaks secret scanning on every push and PR.
