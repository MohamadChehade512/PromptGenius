import { describe, expect, it } from 'vitest';
import { formatPct, formatRange, formatTokens } from './format';

describe('format', () => {
  it('formats token counts compactly', () => {
    expect(formatTokens(950)).toBe('950');
    expect(formatTokens(1_234)).toBe('1.2k');
    expect(formatTokens(12_345)).toBe('12k');
    expect(formatTokens(1_048_576)).toBe('1.05M');
    expect(formatTokens(1_000_000)).toBe('1M');
  });

  it('collapses equal ranges', () => {
    expect(formatRange(100, 100)).toBe('100');
    expect(formatRange(100, 2_000)).toBe('100–2.0k');
  });

  it('formats small percentages', () => {
    expect(formatPct(0.01)).toBe('<0.1%');
    expect(formatPct(3.456)).toBe('3.5%');
    expect(formatPct(42.4)).toBe('42%');
  });
});
