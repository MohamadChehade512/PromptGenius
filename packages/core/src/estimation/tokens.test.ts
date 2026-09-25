import { countTokens } from 'gpt-tokenizer/encoding/o200k_base';
import { describe, expect, it } from 'vitest';
import { estimateBaseTokens, estimateTokens } from './tokens';

const SAMPLES: Record<string, string> = {
  prose:
    'Researchers found that language models perform best when relevant information appears at the beginning or end of the input context, and performance degrades in the middle. '.repeat(
      4,
    ),
  question:
    'Explain the difference between TCP and UDP for a beginner audience in under 150 words.',
  markdown:
    '## Task\nSummarize the report.\n\n## Output\n- 3 bullet points\n- under 100 words\n\n| a | b |\n|---|---|\n| 1 | 2 |\n',
  code: 'export function add(a: number, b: number): number {\n  return a + b;\n}\n\nconst total = [1, 2, 3].map((n) => add(n, 1)).reduce((s, x) => s + x, 0);\n',
  json: JSON.stringify({ users: [{ id: 1, name: 'Ada', email: 'ada@example.com' }] }, null, 2),
  spanish:
    'Hola, ¿cómo estás? Me gustaría aprender más sobre la historia de España y sus reyes durante la Edad Media. '.repeat(
      2,
    ),
  cjk: 'これは日本語のテキストです。トークン数を数えます。中文文本也需要计算。'.repeat(2),
};

describe('estimateBaseTokens', () => {
  it.each(Object.entries(SAMPLES))('is within ±15%% of o200k for %s', (_name, text) => {
    const ratio = estimateBaseTokens(text) / countTokens(text);
    expect(ratio).toBeGreaterThan(0.85);
    expect(ratio).toBeLessThan(1.15);
  });

  it('returns 0 for empty text', () => {
    expect(estimateBaseTokens('')).toBe(0);
  });
});

describe('estimateTokens', () => {
  it('applies the model tokenizer multiplier', () => {
    const text = SAMPLES.prose!;
    const base = estimateTokens(text, { tokenizer: { exact: 'local', multiplier: 1 } });
    const claude = estimateTokens(text, { tokenizer: { exact: 'server', multiplier: 1.2 } });
    expect(claude / base).toBeCloseTo(1.2, 1);
  });
});
