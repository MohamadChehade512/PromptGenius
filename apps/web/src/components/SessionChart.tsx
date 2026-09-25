import type { SessionProjection } from '@promptgenius/core';
import { useId, useState } from 'react';
import { formatTokens, formatUsd } from '../lib/format';

const W = 560;
const H = 220;
const PAD = { top: 16, right: 92, bottom: 30, left: 56 };

/** Round tick step (1/2/2.5/5 × 10^n) giving at most 5 intervals; the axis ends at the first tick ≥ max. */
function ticks(max: number): number[] {
  if (max <= 0) return [0];
  const raw = max / 5;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  return Array.from({ length: Math.ceil(max / step - 1e-9) + 1 }, (_, i) => i * step);
}

/**
 * Cumulative cost over the conversation, without vs with prompt caching. One y-axis
 * (USD); 2px lines in categorical slots 1–2; legend + end labels; hover crosshair; a
 * table view for screen readers and exact values.
 */
export function SessionChart({ session }: { session: SessionProjection }) {
  const titleId = useId();
  const [hover, setHover] = useState<number | null>(null);
  const turns = session.turns;
  const n = turns.length;
  const yTicks = ticks(turns[n - 1]!.cumulativeUncached);
  const yMax = yTicks[yTicks.length - 1]!;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (turn: number) => PAD.left + ((turn - 1) / Math.max(1, n - 1)) * plotW;
  const y = (usd: number) => PAD.top + plotH - (usd / yMax) * plotH;
  const path = (key: 'cumulativeUncached' | 'cumulativeCached') =>
    turns
      .map((t, i) => `${i ? 'L' : 'M'}${x(t.turn).toFixed(1)},${y(t[key]).toFixed(1)}`)
      .join(' ');

  const full = session.turnsUntilFull < n ? session.turnsUntilFull + 1 : null;
  const last = turns[n - 1]!;
  const h = hover === null ? null : turns[hover]!;
  const savings = 1 - last.cumulativeCached / last.cumulativeUncached;
  const caching = session.cachingApplies;

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    setHover(Math.min(n - 1, Math.max(0, Math.round(frac * (n - 1)))));
  }

  return (
    <figure className="viz-root session-chart" aria-labelledby={titleId}>
      <figcaption id={titleId}>
        <strong>Cost over the next {n} turns</strong>: every turn resends the whole history.{' '}
        {caching
          ? `Caching saves about ${Math.round(savings * 100)}% by turn ${n}.`
          : `Caching doesn't apply: the resent history stays under this model's ${session.cacheMinTokens.toLocaleString()}-token cache minimum.`}
      </figcaption>
      <div className="legend" aria-hidden="true">
        <span>
          <i className="key key-1" /> No caching
        </span>
        {caching && (
          <span>
            <i className="key key-2" /> With caching
          </span>
        )}
      </div>
      <div className="chart-wrap">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={
            caching
              ? `Cumulative cost reaches ${formatUsd(last.cumulativeUncached)} without caching and ${formatUsd(last.cumulativeCached)} with caching after ${n} turns.`
              : `Cumulative cost reaches ${formatUsd(last.cumulativeUncached)} after ${n} turns.`
          }
        >
          {yTicks.map((t) => (
            <g key={t}>
              <line className="grid" x1={PAD.left} x2={PAD.left + plotW} y1={y(t)} y2={y(t)} />
              <text className="tick" x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end">
                {formatUsd(t)}
              </text>
            </g>
          ))}
          <text className="tick" x={PAD.left} y={H - 8}>
            Turn 1
          </text>
          <text className="tick" x={PAD.left + plotW} y={H - 8} textAnchor="end">
            Turn {n}
          </text>

          {full && (
            <g className="marker">
              <line x1={x(full)} x2={x(full)} y1={PAD.top} y2={PAD.top + plotH} />
              <text x={x(full) + 4} y={PAD.top + 10}>
                Context full
              </text>
            </g>
          )}

          <path className="series series-1" d={path('cumulativeUncached')} />
          {caching && <path className="series series-2" d={path('cumulativeCached')} />}

          <text className="end-label" x={x(n) + 8} y={y(last.cumulativeUncached)} dy="0.32em">
            {formatUsd(last.cumulativeUncached)}
          </text>
          {caching && (
            <text className="end-label" x={x(n) + 8} y={y(last.cumulativeCached)} dy="0.32em">
              {formatUsd(last.cumulativeCached)}
            </text>
          )}

          {h && (
            <g className="crosshair" pointerEvents="none">
              <line x1={x(h.turn)} x2={x(h.turn)} y1={PAD.top} y2={PAD.top + plotH} />
              <circle className="dot dot-1" cx={x(h.turn)} cy={y(h.cumulativeUncached)} r={4} />
              {caching && (
                <circle className="dot dot-2" cx={x(h.turn)} cy={y(h.cumulativeCached)} r={4} />
              )}
            </g>
          )}
          <rect
            className="hit"
            x={PAD.left}
            y={PAD.top}
            width={plotW}
            height={plotH}
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
        {h && (
          <div className="tooltip" style={{ left: `${(x(h.turn) / W) * 100}%` }} role="status">
            <strong>Turn {h.turn}</strong>
            <span>
              <i className="key key-1" /> {formatUsd(h.cumulativeUncached)}
            </span>
            {caching && (
              <span>
                <i className="key key-2" /> {formatUsd(h.cumulativeCached)}
              </span>
            )}
            <span className="muted">{formatTokens(h.contextTokens)} tokens in context</span>
          </div>
        )}
      </div>
      <details className="table-view">
        <summary>Show as table</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Turn</th>
              <th scope="col">Input tokens</th>
              <th scope="col">Cumulative, no caching</th>
              <th scope="col">Cumulative, with caching</th>
            </tr>
          </thead>
          <tbody>
            {turns.map((t) => (
              <tr key={t.turn}>
                <td>{t.turn}</td>
                <td>{t.inputTokens.toLocaleString()}</td>
                <td>{formatUsd(t.cumulativeUncached)}</td>
                <td>{formatUsd(t.cumulativeCached)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      {session.turnsUntilFull < Infinity && (
        <p className="hint">
          At this pace the {formatTokens(session.contextWindow)}-token window fills after about{' '}
          {session.turnsUntilFull.toLocaleString()} turns.
        </p>
      )}
    </figure>
  );
}
