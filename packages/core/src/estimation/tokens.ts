import type { ModelSpec } from '../config';

const CJK_RE = /[぀-ヿ㐀-䶿一-鿿가-힯豈-﫿]/g;
const WORD_RE = /[\p{L}\p{N}]+/gu;
const PUNCT_RE = /[^\p{L}\p{N}\s]/gu;
const ASCII_WORD_RE = /^[A-Za-z0-9]+$/;

/**
 * Instant, dependency-free token estimate, calibrated against OpenAI's o200k_base
 * tokenizer (worst case about ±10% on English prose, Markdown, code, CSS, JSON, Spanish,
 * French and CJK; see tokens.test.ts). Each model's `tokenizer.multiplier` converts that
 * baseline to its own vendor tokenizer. It is a stand-in until an exact count arrives.
 *
 * - Words up to 6 characters are about one token; longer words split further.
 * - Punctuation and symbols are nearly a token each; newlines cost a little.
 * - CJK characters are roughly 0.7 tokens each.
 */
export function estimateBaseTokens(text: string): number {
  if (!text) return 0;
  const cjk = text.match(CJK_RE)?.length ?? 0;
  let words = 0;
  for (const w of text.replace(CJK_RE, ' ').match(WORD_RE) ?? []) {
    words += w.length <= 6 ? 1 : 1 + (w.length - 6) / (ASCII_WORD_RE.test(w) ? 6 : 2);
  }
  const punct = text.match(PUNCT_RE)?.length ?? 0;
  const newlines = text.match(/\n/g)?.length ?? 0;
  return words + punct * 0.9 + cjk * 0.7 + newlines * 0.6;
}

export function estimateTokens(text: string, model: Pick<ModelSpec, 'tokenizer'>): number {
  if (!text) return 0;
  return Math.max(1, Math.round(estimateBaseTokens(text) * model.tokenizer.multiplier));
}

export type TokenCountMethod = 'estimate' | 'local-tokenizer' | 'vendor-api';

export interface TokenCount {
  tokens: number;
  method: TokenCountMethod;
}
