import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const EnvSchema = z.object({
  API_PORT: z.coerce.number().int().positive().default(8787),
  // Optional until M5 (exact counting) and M7 (rewrite) need them.
  ANTHROPIC_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  REWRITE_DAILY_CAP_USD: z.coerce.number().positive().default(2),
});
export type Env = z.infer<typeof EnvSchema>;

/** Loads the repo-root .env.local (if present) and validates it. Local development only. */
export function loadLocalEnv(): Env {
  const envFile = fileURLToPath(new URL('../../../.env.local', import.meta.url));
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  return EnvSchema.parse(process.env);
}
