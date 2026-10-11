import { useEffect, useState } from 'react';
import { useInView, useReducedMotion } from '../../lib/motion';
import { SPOKEN } from './demoData';
import { Counter, ScoreRing } from './parts';

type Phase = 'idle' | 'say1' | 'fix1' | 'say2' | 'done';
const NEXT: Record<Phase, Phase> = {
  idle: 'say1',
  say1: 'fix1',
  fix1: 'say2',
  say2: 'done',
  done: 'idle',
};
/** How long each phase rests before the next one (after its words have been spoken). */
const HOLD: Record<Phase, number> = { idle: 900, say1: 350, fix1: 2600, say2: 350, done: 6500 };
const WORD_MS = 150;
const ORDER: Phase[] = ['idle', 'say1', 'fix1', 'say2', 'done'];
const STATUS: Record<Phase, string> = {
  idle: 'Tap the mic and talk',
  say1: 'Listening…',
  fix1: 'Fixed a slip · here’s what to add',
  say2: 'Listening…',
  done: 'Done · ready to copy',
};

/**
 * Prompt Studio, shown working: a sentence is spoken word by word, the slips are struck out, the
 * prompt builds, and the score and token saving update as context is added. Plays in a loop once
 * scrolled into view; with reduced motion it shows the finished result.
 */
export function StudioDemo() {
  const reduce = useReducedMotion();
  const [ref, seen] = useInView<HTMLElement>(0.3);
  const [live, setLive] = useState<{ phase: Phase; words: number }>({ phase: 'idle', words: 0 });
  const [playing, setPlaying] = useState(true);
  const { phase, words } = reduce ? { phase: 'done' as const, words: 0 } : live;

  const speaking = phase === 'say1' || phase === 'say2';
  const spoken = phase === 'say1' ? SPOKEN.first.length : SPOKEN.second.length;
  useEffect(() => {
    if (!seen || reduce || !playing) return;
    const more = speaking && words < spoken;
    const t = window.setTimeout(
      () => setLive(more ? { phase, words: words + 1 } : { phase: NEXT[phase], words: 0 }),
      more ? WORD_MS : HOLD[phase],
    );
    return () => window.clearTimeout(t);
  }, [seen, reduce, playing, phase, words, speaking, spoken]);

  const at = ORDER.indexOf(phase);
  const cleaned = at >= 2;
  const done = phase === 'done';
  const firstShown = phase === 'say1' ? words : at >= 2 ? SPOKEN.first.length : 0;
  const secondShown = phase === 'say2' ? words : done ? SPOKEN.second.length : 0;
  const saved = SPOKEN.before.perAnswer - SPOKEN.after.perAnswer;

  return (
    <figure
      ref={ref}
      className="sd"
      data-phase={phase}
      aria-label="Example: a spoken request turned into a prompt by Prompt Studio"
    >
      <div className="demo-bar">
        <span className="demo-meta">Example · Prompt Studio</span>
        {!reduce && (
          <button
            type="button"
            className="icon-button"
            onClick={() => setPlaying((v) => !v)}
            aria-label={playing ? 'Pause the example' : 'Play the example'}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {playing ? <path d="M8 5v14M16 5v14" /> : <path d="M7 5l12 7-12 7z" />}
            </svg>
          </button>
        )}
      </div>

      <div className="sd-body" aria-hidden="true">
        <div className="sd-stage">
          <span className="sd-mic" data-on={speaking || undefined}>
            <svg viewBox="0 0 24 24">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
            </svg>
          </span>
          <span className="sd-wave" data-on={speaking || undefined}>
            {Array.from({ length: 14 }, (_, i) => (
              <i key={i} style={{ animationDelay: `${(i * 83) % 520}ms` }} />
            ))}
          </span>
          <span className="sd-status" key={phase}>
            {STATUS[phase]}
          </span>
        </div>

        <div className="sd-block">
          <p className="sd-label">You said</p>
          <p className="sd-said">
            {firstShown === 0 && <span className="sd-placeholder">…</span>}
            {SPOKEN.first.slice(0, firstShown).map((w, i) => (
              <span
                key={i}
                className="sd-word"
                data-cut={('cut' in w && w.cut && cleaned) || undefined}
              >
                {w.word}{' '}
              </span>
            ))}
            {SPOKEN.second.slice(0, secondShown).map((w, i) => (
              <span key={`b${i}`} className="sd-word" data-folded={done || undefined}>
                {w}{' '}
              </span>
            ))}
            {speaking && <span className="sd-caret" />}
          </p>
        </div>

        <div className="sd-block sd-result" data-on={cleaned || undefined}>
          <div className="sd-prompt">
            <p className="sd-label">
              Your prompt <span className="sd-built">Built by Studio</span>
            </p>
            <p className="sd-line">{SPOKEN.request}</p>
            {SPOKEN.context.map((line, i) => (
              <p
                key={line}
                className="sd-line sd-line-new"
                data-on={done || undefined}
                style={{ transitionDelay: `${i * 160}ms` }}
              >
                {line}
              </p>
            ))}
            <ul className="sd-coach">
              {SPOKEN.coach.map((c) => {
                const ticked = c.done && done;
                return (
                  <li key={c.label} data-done={ticked || undefined}>
                    {ticked ? '✓ ' : ''}
                    {ticked ? c.label.replace('Add a ', 'Added a ') : c.label}
                    {!ticked && <span>+{c.points}</span>}
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="sd-score">
            <ScoreRing
              score={cleaned ? (done ? SPOKEN.after : SPOKEN.before).score : 0}
              size={84}
            />
            <p className="sd-score-label">Prompt quality</p>
          </div>
        </div>

        <p className="sd-saving" data-on={done || undefined}>
          <strong>Saves about {saved.toLocaleString()} tokens per answer</strong>
          <span>
            ≈
            <Counter value={(done ? SPOKEN.after : SPOKEN.before).perAnswer} ms={1100} /> tokens,
            down from ≈{SPOKEN.before.perAnswer.toLocaleString()}
          </span>
        </p>
      </div>
      <figcaption className="demo-caption">
        Real Prompt Studio results for this sentence, estimated for Claude. Tokens per answer =
        prompt + expected answer + thinking.
      </figcaption>
    </figure>
  );
}
