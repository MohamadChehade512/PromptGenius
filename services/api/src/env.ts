import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const optionalKey = z
  .string()
  .optional()
  .transform((v) => (v?.trim() ? v.trim() : undefined));

const EnvSchema = z.object({
  API_PORT: z.coerce.number().int().positive().default(8787),
  ANTHROPIC_API_KEY: optionalKey,
  GEMINI_API_KEY: optionalKey,
  REWRITE_DAILY_CAP_USD: z.coerce.number().positive().default(2),
  REWRITE_MODEL: z.string().default('claude-opus-5'),
  REWRITE_EFFORT: z.enum(['low', 'medium', 'high']).default('medium'),
});
export type Env = z.infer<typeof EnvSchema>;

export const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

/** Loads the repo-root .env.local (if present) and validates it. Local development only. */
export function loadLocalEnv(): Env {
  const envFile = `${REPO_ROOT}.env.local`;
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  return EnvSchema.parse(process.env);
}
