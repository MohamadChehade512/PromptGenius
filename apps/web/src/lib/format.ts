export { formatUsd } from '@promptgenius/core';

/** 950 → "950", 12_345 → "12.3k", 1_048_576 → "1.05M". */
export function formatTokens(n: number): string {
  if (n < 1_000) return String(Math.round(n));
  if (n < 1_000_000) return `${(n / 1_000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`;
}

export function formatRange(
  low: number,
  high: number,
  fmt: (n: number) => string = formatTokens,
): string {
  return fmt(low) === fmt(high) ? fmt(low) : `${fmt(low)}–${fmt(high)}`;
}

export function formatPct(p: number): string {
  if (p === 0) return '0%';
  if (p < 0.1) return '<0.1%';
  if (p < 10) return `${p.toFixed(1)}%`;
  return `${Math.round(p)}%`;
}

/** 512 → "512 B", 48_000 → "47 KB", 1_400_000 → "1.3 MB". */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
