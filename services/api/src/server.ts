import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import { serve } from '@hono/node-server';
import { createApp } from './app';
import { AnthropicTokenCounter } from './counters/anthropic';
import { CachingCounter } from './counters/cache';
import { GeminiTokenCounter } from './counters/gemini';
import type { AppDeps } from './deps';
import { REPO_ROOT, loadLocalEnv } from './env';
import { MemoryRateLimiter } from './ratelimit/memory';
import { ClaudeRewriter } from './rewrite/claude-rewriter';
import { FileSpendStore } from './spend/file-store';

const env = loadLocalEnv();
const anthropic = env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
  : undefined;
const gemini = env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: env.GEMINI_API_KEY }) : undefined;

const deps: AppDeps = {
  counters: {
    claude: anthropic && new CachingCounter(new AnthropicTokenCounter(anthropic)),
    gemini: gemini && new CachingCounter(new GeminiTokenCounter(gemini)),
  },
  rewriter:
    anthropic &&
    new ClaudeRewriter(anthropic, { model: env.REWRITE_MODEL, effort: env.REWRITE_EFFORT }),
  spend: new FileSpendStore(`${REPO_ROOT}.local-state/spend.json`, env.REWRITE_DAILY_CAP_USD),
  limiter: new MemoryRateLimiter(),
};

const on = (b: unknown) => (b ? 'on' : 'off (no key)');
// Bind to loopback only: the local API is reachable from this machine, not the network.
serve({ fetch: createApp(deps).fetch, hostname: '127.0.0.1', port: env.API_PORT }, (info) => {
  console.log(`API listening on http://127.0.0.1:${info.port}/api`);
  console.log(
    `  exact counts: Claude ${on(deps.counters.claude)}, Gemini ${on(deps.counters.gemini)}`,
  );
  console.log(
    `  AI rewrite (paid): ${on(deps.rewriter)}${deps.rewriter ? `, ${env.REWRITE_MODEL}, cap $${env.REWRITE_DAILY_CAP_USD}/day` : ''}`,
  );
});
