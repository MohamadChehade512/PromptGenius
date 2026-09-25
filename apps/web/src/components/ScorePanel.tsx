import type { Finding, ScoreBand, ScoreResult } from '@promptgenius/core';
import { BAND_TONES } from '../lib/scoreTone';
import { SourceLinks } from './SourceLinks';

const BAND_LABELS: Record<ScoreBand, string> = {
  excellent: 'Excellent',
  good: 'Good',
  'needs-work': 'Needs work',
  weak: 'Weak',
};

function Dial({ score, band }: { score: number; band: ScoreBand }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div
      className={`dial tone-${BAND_TONES[band]}`}
      role="img"
      aria-label={`Prompt score ${score} out of 100: ${BAND_LABELS[band]}`}
    >
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className="dial-track" cx="60" cy="60" r={r} />
        <circle
          className="dial-value"
          cx="60"
          cy="60"
          r={r}
          strokeDasharray={`${(score / 100) * c} ${c}`}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div className="dial-text" aria-hidden="true">
        <span className="dial-score">{score}</span>
        <span className="dial-max">/100</span>
      </div>
    </div>
  );
}

function Suggestion({ f }: { f: Finding }) {
  return (
    <li className="suggestion">
      <span className="points">+{Math.max(1, Math.round(f.points))}</span>
      <div>
        <strong>{f.title}.</strong> {f.message}
        <p className="fix">{f.suggestion}</p>
        {f.evidence && f.evidence.length > 0 && (
          <p className="evidence">Found: {f.evidence.map((e) => `“${e}”`).join(', ')}</p>
        )}
        <SourceLinks sources={f.sources} />
      </div>
    </li>
  );
}

export function ScorePanel({ score, advanced }: { score: ScoreResult | null; advanced: boolean }) {
  if (!score) {
    return (
      <section className="card score" aria-labelledby="score-title" data-tour="score">
        <h2 id="score-title">Prompt score</h2>
        <p className="muted">Start typing to see a score and suggestions.</p>
      </section>
    );
  }
  const shown = advanced ? score.findings : score.findings.slice(0, 3);
  return (
    <section className="card score" aria-labelledby="score-title" data-tour="score">
      <h2 id="score-title">Prompt score</h2>
      <div className="score-head" aria-live="polite">
        <Dial score={score.total} band={score.band} />
        <div>
          <p className={`band band-${score.band} tone-${BAND_TONES[score.band]}`}>
            <i className="tone-dot" aria-hidden="true" />
            {BAND_LABELS[score.band]}
          </p>
          <p className="hint">
            Measures clarity, context, output spec and token economy against each vendor's official
            guidance.
          </p>
        </div>
      </div>

      {advanced && (
        <ul className="dimensions">
          {score.dimensions.map((d) => (
            <li key={d.id}>
              <span>{d.label}</span>
              <div className="bar small" aria-hidden="true">
                <div className="bar-fill" style={{ width: `${(d.score / d.max) * 100}%` }} />
              </div>
              <span className="dim-value">
                {Math.round(d.score)}/{Math.round(d.max)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {shown.length > 0 ? (
        <>
          <h3>{advanced ? 'All suggestions' : 'Top suggestions'}</h3>
          <ul className="suggestions">
            {shown.map((f) => (
              <Suggestion key={f.ruleId} f={f} />
            ))}
          </ul>
          {!advanced && score.findings.length > 3 && (
            <p className="hint">{score.findings.length - 3} more in Advanced mode.</p>
          )}
        </>
      ) : (
        <p className="muted">No issues found. This prompt follows the platform's guidance.</p>
      )}
    </section>
  );
}
