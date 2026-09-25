import { z } from 'zod';
import { EFFORT_LEVELS, PLATFORMS } from '../types';

const Usd = z.number().nonnegative();

export const PricingSchema = z.object({
  /** USD per 1M tokens. */
  input: Usd,
  output: Usd,
  /** Cache read price. Defaults to 10% of input when omitted. */
  cacheRead: Usd.optional(),
  /** Cache write price. Defaults to the input price (no premium) when omitted. */
  cacheWrite: Usd.optional(),
  /** Whole request is billed at these rates once input exceeds the threshold. */
  longContext: z
    .object({ thresholdTokens: z.number().int().positive(), input: Usd, output: Usd })
    .optional(),
});

/**
 * How a vendor turns images and PDF pages into input tokens (PLAN.md §1.2b).
 * - patch: ceil(w/patchPx) × ceil(h/patchPx) patches × multiplier, after downscaling the
 *   image to fit maxLongEdge and maxPatches (Claude 28px, OpenAI 32px × 1.2).
 * - fixed: a flat count per image (Gemini 3: 1,120 at the default media resolution).
 */
export const ImageTokenSchema = z.discriminatedUnion('scheme', [
  z.object({
    scheme: z.literal('patch'),
    patchPx: z.number().int().positive(),
    multiplier: z.number().positive().default(1),
    maxLongEdge: z.number().int().positive(),
    maxPatches: z.number().int().positive(),
  }),
  z.object({ scheme: z.literal('fixed'), tokens: z.number().int().positive() }),
]);

export const MediaSchema = z.object({
  image: ImageTokenSchema,
  pdfPage: z.object({
    /** Flat tokens per page (Gemini). When omitted, each page is priced as a rendered page image. */
    tokens: z.number().int().positive().optional(),
    /** Whether the page's extracted text is billed on top of the page image. */
    includesText: z.boolean(),
  }),
  verified: z.boolean(),
  notes: z.string().optional(),
});

export const ModelSchema = z.object({
  id: z.string(),
  label: z.string(),
  tier: z.enum(['flagship', 'balanced', 'fast']),
  default: z.boolean().optional(),
  contextWindow: z.number().int().positive(),
  maxOutput: z.number().int().positive(),
  pricing: PricingSchema,
  cacheMinTokens: z.number().int().nonnegative(),
  tokenizer: z.object({
    /** 'local' = exact tokenizer runs in the browser; 'server' = vendor count endpoint. */
    exact: z.enum(['local', 'server']),
    /**
     * Converts the o200k-calibrated baseline estimate to this vendor's tokenizer.
     * Claude: tiktoken-family counts undercount by ~15-20%, and the tokenizer introduced
     * with Opus 4.7 uses ~1.0-1.35x more again, so ~1.1 (older) / ~1.2 (newer).
     */
    multiplier: z.number().positive().default(1),
  }),
  reasoning: z
    .object({
      levels: z.array(z.enum(EFFORT_LEVELS)).min(1),
      default: z.enum(EFFORT_LEVELS),
    })
    .nullable(),
  /** Field names whose values could not be confirmed from an official source. */
  unverified: z.array(z.string()).default([]),
  notes: z.string().optional(),
  /** Overrides the platform's media rules (e.g. an older model with a lower image resolution). */
  media: MediaSchema.optional(),
});

export const ConsumerPlanSchema = z.object({
  id: z.string(),
  label: z.string(),
  contextWindow: z.number().int().positive(),
  verified: z.boolean(),
});

export const PlatformConfigSchema = z.object({
  label: z.string(),
  pricingUrl: z.url(),
  models: z.array(ModelSchema).min(1),
  media: MediaSchema,
  consumerPlans: z.array(ConsumerPlanSchema).min(1),
});

export const ModelsConfigSchema = z.object({
  lastVerified: z.iso.date(),
  /** Reference exchange used by Simple mode: "this prompt ≈ N typical messages". */
  typicalMessage: z.object({ inputTokens: z.number().int(), outputTokens: z.number().int() }),
  platforms: z.record(z.enum(PLATFORMS), PlatformConfigSchema),
});

export type Pricing = z.infer<typeof PricingSchema>;
export type ModelSpec = z.infer<typeof ModelSchema>;
export type MediaSpec = z.infer<typeof MediaSchema>;
export type ImageTokenSpec = z.infer<typeof ImageTokenSchema>;
export type ConsumerPlan = z.infer<typeof ConsumerPlanSchema>;
export type PlatformConfig = z.infer<typeof PlatformConfigSchema>;
export type ModelsConfig = z.infer<typeof ModelsConfigSchema>;
