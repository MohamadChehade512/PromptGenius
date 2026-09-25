/**
 * Exact-as-available local tokenizer for OpenAI models (o200k_base), loaded lazily so the
 * ~2 MB encoding never blocks first paint. OpenAI's docs don't name GPT-6's encoding, so
 * this is o200k_base as the best available reference (see models.json `unverified`).
 */
let loader: Promise<(text: string) => number> | undefined;

export function loadOpenAITokenizer(): Promise<(text: string) => number> {
  loader ??= import('gpt-tokenizer/encoding/o200k_base').then(
    (m) => (text: string) => m.countTokens(text),
  );
  return loader;
}
