# PromptGenius

Build better prompts for **Claude**, **ChatGPT** and **Gemini**: live token, cost and context
estimates, plus a 0–100 prompt score with concrete suggestions. Attach PDFs, Word files, images
or text to see what they add in tokens and how they change the score.

See [PLAN.md](PLAN.md) for the research, the scoring algorithm and the roadmap.

## Getting started

Requirements: **Node 24+** (see `.nvmrc`) and **pnpm** (version pinned in `package.json`).

```sh
sudo corepack enable pnpm    # one-time: put pnpm on your PATH
pnpm install
cp .env.example .env.local   # optional: add API keys (never commit .env.local)
pnpm dev                     # web → http://localhost:5173 · API → http://127.0.0.1:8787/api
```

Everything works without keys: token counts fall back to a local estimate (about ±10%),
and the AI rewrite button stays disabled with an explanation. With keys:

| Key                 | Enables                                            | Cost                   |
| ------------------- | -------------------------------------------------- | ---------------------- |
| `ANTHROPIC_API_KEY` | Exact Claude token counts                          | Free                   |
| `ANTHROPIC_API_KEY` | **AI rewrite** (Claude Opus 5 by default)          | **Paid**, ≈ $0.02–0.15 |
| `GEMINI_API_KEY`    | Exact Gemini token counts                          | Free                   |
| (none)              | Exact ChatGPT token counts (local o200k tokenizer) | Free                   |

The rewrite is the only paid action. It shows its price before you click, asks for
confirmation once per session, shows the actual cost afterwards, and is capped at
`REWRITE_DAILY_CAP_USD` (default **$2/day**, tracked in `.local-state/spend.json`). Set a
spend limit in the Anthropic Console as a backstop.

## Scripts

| Command                                      | What it does                                                      |
| -------------------------------------------- | ----------------------------------------------------------------- |
| `pnpm dev`                                   | Runs the web app and the local API together (Vite proxies `/api`) |
| `pnpm check`                                 | Format check, lint, typecheck and tests (same as CI)              |
| `pnpm test:watch`                            | Vitest in watch mode                                              |
| `pnpm build`                                 | Production build of the web app                                   |
| `pnpm format`                                | Formats the repo with Prettier                                    |
| `pnpm --filter @promptgenius/core calibrate` | Prints the scoring calibration table (PLAN.md §2.7)               |

## Updating prices and models

All prices, context windows, cache minimums, tokenizer multipliers and image/PDF token rules
(`media`) live in
[`packages/core/src/config/models.json`](packages/core/src/config/models.json), validated by a
schema at load. Update `lastVerified` when you re-check them; fields that couldn't be
confirmed from an official source are listed in each model's `unverified` array.

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
- The local API binds to `127.0.0.1` only, validates every request (unknown fields are rejected),
  rate-limits requests, and never stores or logs prompts (the count cache keys on a SHA-256 hash).
- The rewrite passes your prompt to Claude as delimited data, never as instructions, and the
  structured output is schema-validated and rendered as plain text.
- Attached files are read only in the browser and never uploaded; the rewrite receives file
  names only, never contents.
- CI runs gitleaks secret scanning on every push and PR.
