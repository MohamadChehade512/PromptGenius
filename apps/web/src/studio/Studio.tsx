import {
  PLATFORMS,
  PLATFORM_LABELS,
  USE_CASES,
  USE_CASE_LABELS,
  analyzePrompt,
  guessUseCase,
  refineSpeech,
  type AnalysisResult,
  type PlatformId,
  type ScoreBand,
  type UseCase,
} from '@promptgenius/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Segmented } from '../components/Segmented';
import { usePersistentState } from '../hooks/usePersistentState';
import { useSpeechRecognition, type SpeechError } from '../hooks/useSpeechRecognition';
import { ApiKeyControl } from '../components/ApiKeyControl';
import { useStudioRefine, useStudioStatus } from '../hooks/useStudioRefine';
import { useApiKey } from '../lib/apiKey';
import { formatUsd } from '../lib/format';
import { HANDOFF_KEY } from '../lib/handoff';
import { BAND_TONES } from '../lib/scoreTone';
import { describeChange, markSaid } from '../lib/speechDiff';
import { writeStorage } from '../lib/storage';
import { coachTips } from '../lib/voiceCoach';
import { Counter, ScoreRing } from '../site/home/parts';

const PLATFORM_OPTIONS = PLATFORMS.map((p) => ({ value: p, label: PLATFORM_LABELS[p] }));
const BAND_LABELS: Record<ScoreBand, string> = {
  excellent: 'Excellent',
  good: 'Good',
  'needs-work': 'Needs work',
  weak: 'Weak',
};
const ERROR_TEXT: Record<SpeechError, string> = {
  denied:
    'Microphone access is blocked. Allow the microphone for this site in your browser’s address bar, then try again.',
  'no-microphone': 'No microphone was found. Plug one in or check your sound settings.',
  network: 'Speech recognition couldn’t reach its service. Check your connection and try again.',
  failed: 'Speech recognition stopped unexpectedly. Try again.',
};
/** Things to try, shown before anything has been said. */
const EXAMPLES = [
  '“Draft an email to Sam… I mean Alex, about Friday’s launch.”',
  '“Explain fractions for my daughter. She’s in grade four.”',
  '“Give me five ideas for a LinkedIn post. Keep it short.”',
];
const LABEL_RE = /^(Purpose|Context|Audience|Tone|Format|Length):\s*(.*)$/;

type CopyState = 'idle' | 'copied' | 'failed';

/** The number of points the score just rose by, shown briefly. */
function useScoreGain(score: number | undefined): number {
  const previous = useRef(score);
  const [gain, setGain] = useState(0);
  useEffect(() => {
    const before = previous.current;
    previous.current = score;
    if (score === undefined || before === undefined || score <= before) return;
    const show = window.setTimeout(() => setGain(score - before), 0);
    const hide = window.setTimeout(() => setGain(0), 1800);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, [score]);
  return gain;
}

/** Rotates through example things to say. */
function Examples() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setI((n) => (n + 1) % EXAMPLES.length), 3800);
    return () => window.clearInterval(t);
  }, []);
  return (
    <p className="stage-example" key={i}>
      Try: {EXAMPLES[i]}
    </p>
  );
}

/** Everything one call uses: what's sent, plus the answer (and thinking) it's likely to get. */
const perAnswer = (a: AnalysisResult) =>
  a.inputTokens + a.output.visible.mid + (a.reasoning ? a.output.thinking.mid : 0);

function ImpactRow(props: {
  label: string;
  before: number;
  after: number;
  /** Whether a higher number is the improvement (quality) or a lower one (tokens). */
  better: 'higher' | 'lower';
  unit?: string;
  approx?: boolean;
}) {
  const { before, after, better } = props;
  const improved = better === 'higher' ? after > before : after < before;
  const change =
    better === 'higher'
      ? `${after >= before ? '+' : '−'}${Math.abs(after - before)}`
      : before > 0
        ? `${after <= before ? '−' : '+'}${Math.round((Math.abs(before - after) / before) * 100)}%`
        : '';
  const tilde = props.approx ? '≈' : '';
  return (
    <tr>
      <th scope="row">{props.label}</th>
      <td className="impact-before">
        {tilde}
        {before.toLocaleString()}
      </td>
      <td className="impact-after">
        {tilde}
        <Counter value={after} from={before} />
        {props.unit && <span className="unit"> {props.unit}</span>}
      </td>
      <td>
        {after !== before && (
          <span className={improved ? 'impact-delta impact-good' : 'impact-delta'}>{change}</span>
        )}
      </td>
    </tr>
  );
}

/**
 * What Studio gained you. Two honest comparisons:
 * - the request on its own (no tone, length, purpose…) against the finished prompt, for quality
 *   and the tokens one answer is likely to use: this is what the added context buys;
 * - the words as spoken against the prompt, for what the clean-up trimmed.
 * When no context was added, the first comparison is spoken vs refined too.
 */
function Impact(props: {
  /** The request without the context lines; undefined when there are none. */
  bare?: AnalysisResult;
  spoken: AnalysisResult;
  refined: AnalysisResult;
}) {
  const { spoken, refined } = props;
  const baseline = props.bare ?? spoken;
  const before = perAnswer(baseline);
  const after = perAnswer(refined);
  const savedTokens = before - after;
  const trimmed = spoken.promptTokens.tokens - refined.promptTokens.tokens;
  return (
    <div className="impact">
      <table className="impact-table">
        <caption>
          {savedTokens > 0 ? (
            <>
              Saves about <strong>{savedTokens.toLocaleString()} tokens</strong> per answer
            </>
          ) : (
            'What refining changed'
          )}
        </caption>
        <thead>
          <tr>
            <th scope="col">
              <span className="visually-hidden">Measure</span>
            </th>
            <th scope="col">{props.bare ? 'Request alone' : 'As spoken'}</th>
            <th scope="col">Now</th>
            <th scope="col">
              <span className="visually-hidden">Change</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <ImpactRow
            label="Quality"
            before={baseline.score!.total}
            after={refined.score!.total}
            better="higher"
          />
          <ImpactRow
            label="Per answer"
            before={before}
            after={after}
            better="lower"
            unit="tokens"
            approx
          />
        </tbody>
      </table>
      <p className="impact-prompt">
        Prompt: <strong>{refined.promptTokens.tokens.toLocaleString()} tokens</strong>
        {trimmed > 0 && (
          <>
            {' '}
            <span className="saves-tag">{trimmed} fewer than as spoken</span>
          </>
        )}
      </p>
      <p className="hint">
        {props.bare ? '“Request alone” is your first line without the context you added. ' : ''}
        Per answer = prompt + the reply and thinking it’s likely to get (estimates). Saying what you
        want, and how long, gets a shorter, more focused answer.
      </p>
    </div>
  );
}

function FlowArrow({ active }: { active: boolean }) {
  return (
    <div className="flow-arrow" data-active={active || undefined} aria-hidden="true">
      <svg viewBox="0 0 48 16">
        <path className="flow-line" d="M2 8h38" />
        <path className="flow-head" d="m36 3 6 5-6 5" />
      </svg>
    </div>
  );
}

/**
 * Prompt Studio: speak a prompt and watch it get built. Three stages, left to right: what you
 * said (with the words that were dropped struck through), what was changed, and the finished
 * prompt with its score. The built-in refiner (packages/core refineSpeech) is free and local;
 * "Refine with Claude" is the optional paid step.
 */
export function Studio(props: { refineDelayMs?: number } = {}) {
  const [platform, setPlatform] = usePersistentState<PlatformId>('pg.platform', 'claude');
  // "auto" works the use case out from what was said, so nobody has to pick one mid-sentence.
  const [useCaseChoice, setUseCaseChoice] = usePersistentState<UseCase | 'auto'>(
    'pg.studioUseCase',
    'auto',
  );
  // What was heard (editable, so a misheard word can be fixed by hand). Never stored.
  const [heard, setHeard] = useState('');
  const [copy, setCopy] = useState<CopyState>('idle');
  // PAID, so it's off until switched on, and never remembered between visits.
  const [useClaude, setUseClaude] = useState(false);
  const claudeStatus = useStudioStatus();
  const ownKey = useApiKey();

  const addPhrase = useCallback(
    (text: string) => setHeard((prev) => (prev ? `${prev.trimEnd()} ${text}` : text)),
    [],
  );
  const speech = useSpeechRecognition(addPhrase);
  // Without speech recognition, typing is the way in, so the text box starts open.
  const [editing, setEditing] = useState(!speech.supported);

  // The built-in, rules-only version: instant, free, and the fallback while Claude works.
  const refined = useMemo(() => refineSpeech(heard), [heard]);
  const useCase = useCaseChoice === 'auto' ? guessUseCase(refined.cleaned) : useCaseChoice;
  const ruleAnalysis = useMemo(
    () => analyzePrompt({ platform, useCase, mode: 'simple', prompt: refined.prompt }),
    [platform, useCase, refined.prompt],
  );
  const gaps = useMemo(
    () =>
      (ruleAnalysis.score?.findings ?? [])
        .filter((f) => !f.ruleId.startsWith('engine.'))
        .slice(0, 5)
        .map((f) => f.title),
    [ruleAnalysis.score],
  );
  const claude = useStudioRefine({
    enabled: useClaude && !!claudeStatus,
    transcript: heard,
    platform,
    gaps,
    delayMs: props.refineDelayMs,
  });
  // What's shown, scored and copied: Claude's version once there is one, else the rules'.
  const claudePrompt = claude.result?.prompt.trim();
  const prompt = claudePrompt || refined.prompt;
  const analysis = useMemo(
    () => analyzePrompt({ platform, useCase, mode: 'simple', prompt }),
    [platform, useCase, prompt],
  );
  // The same request exactly as it was spoken, as the baseline for what refining saved.
  const spoken = useMemo(
    () => analyzePrompt({ platform, useCase, mode: 'simple', prompt: heard }),
    [platform, useCase, heard],
  );
  const score = analysis.score;
  const tips = score ? coachTips(score.findings, 3) : [];
  const gain = useScoreGain(score?.total);

  const words = useMemo(
    () => markSaid(heard, refined.cleaned, refined.prompt),
    [heard, refined.cleaned, refined.prompt],
  );
  const changes =
    claudePrompt && claude.result ? claude.result.changes : refined.changes.map(describeChange);
  const lines = prompt.split('\n').filter((l) => l.trim());
  // The request on its own, before any context lines: what the added context is measured against.
  const firstLine = lines[0] ?? '';
  const bare = useMemo(
    () =>
      lines.length > 1
        ? analyzePrompt({ platform, useCase, mode: 'simple', prompt: firstLine })
        : undefined,
    [platform, useCase, firstLine, lines.length],
  );

  useEffect(() => {
    if (copy === 'idle') return;
    const t = window.setTimeout(() => setCopy('idle'), 2000);
    return () => window.clearTimeout(t);
  }, [copy]);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopy('copied');
    } catch {
      setCopy('failed');
    }
  }

  function openInWorkshop() {
    writeStorage('session', HANDOFF_KEY, prompt);
    window.location.assign('/workshop');
  }

  function clear() {
    setHeard('');
    setEditing(!speech.supported);
  }

  const status = !speech.supported
    ? 'Voice isn’t available in this browser'
    : speech.listening
      ? 'Listening…'
      : heard
        ? 'Tap to keep talking'
        : 'Tap and say what you need';
  const working = speech.listening || claude.updating;

  return (
    <div className="shell studio" data-tone={score ? BAND_TONES[score.band] : undefined}>
      <div className="page-head">
        <div>
          <h1 className="display">Prompt Studio</h1>
          <p className="tagline">Say what you need. Watch it become a prompt.</p>
        </div>
      </div>

      <main className="studio-main">
        {/* The stage: one big button. */}
        <section className="stage" aria-label="Speak" data-on={speech.listening || undefined}>
          <button
            type="button"
            className="mic"
            data-on={speech.listening || undefined}
            onClick={speech.listening ? speech.stop : speech.start}
            disabled={!speech.supported}
            aria-pressed={speech.listening}
            aria-label={speech.listening ? 'Stop the microphone' : 'Start speaking'}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {speech.listening ? (
                <rect x="7" y="7" width="10" height="10" rx="2" />
              ) : (
                <>
                  <rect x="9" y="3" width="6" height="11" rx="3" />
                  <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
                </>
              )}
            </svg>
          </button>
          <div className="stage-text">
            <p className="mic-status" role="status">
              {status}
            </p>
            <div className="wave" data-on={speech.listening || undefined} aria-hidden="true">
              {Array.from({ length: 9 }, (_, i) => (
                <span key={i} style={{ animationDelay: `${(i % 5) * 110}ms` }} />
              ))}
            </div>
            {speech.interim ? (
              <p className="interim" aria-hidden="true">
                {speech.interim}
              </p>
            ) : heard ? (
              <p className="stage-hint">
                Slip up? Just say “I mean…”. Add context any time: “the tone should be…”.
              </p>
            ) : speech.supported ? (
              <Examples />
            ) : (
              <p className="stage-hint">
                Speech recognition works in Chrome, Edge and Safari. Type below instead: it’s
                refined and scored the same way.
              </p>
            )}
          </div>
          {speech.error && (
            <p className="error stage-error" role="alert">
              {ERROR_TEXT[speech.error]}
            </p>
          )}
        </section>

        {/* The flow: said → changed → prompt. */}
        <div className="flow">
          <section className="flow-step card" aria-labelledby="step-said">
            <div className="step-head">
              <span className="step-num">1</span>
              <h2 id="step-said">You said</h2>
              <span className="step-actions">
                {heard && speech.supported && (
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => setEditing((e) => !e)}
                  >
                    {editing ? 'Done' : 'Edit'}
                  </button>
                )}
                {heard && (
                  <button type="button" className="link-button" onClick={clear}>
                    Clear
                  </button>
                )}
              </span>
            </div>
            {editing ? (
              <>
                <label htmlFor="heard" className="visually-hidden">
                  What I heard
                </label>
                <textarea
                  id="heard"
                  rows={6}
                  value={heard}
                  onChange={(e) => setHeard(e.target.value)}
                  placeholder="Type what you’d say, or fix a misheard word."
                />
              </>
            ) : heard ? (
              <p className="said" aria-label="What I heard">
                {words.map((w, i) => (
                  <span key={i} className={w.state === 'kept' ? undefined : `said-${w.state}`}>
                    {w.text}{' '}
                  </span>
                ))}
              </p>
            ) : (
              <p className="muted step-empty">Your words appear here as you speak.</p>
            )}
            {heard && !editing && words.some((w) => w.state !== 'kept') && (
              <p className="hint said-legend">
                {words.some((w) => w.state === 'cut') && (
                  <span>
                    <span className="said-cut">Struck</span> = slips and filler, dropped
                  </span>
                )}
                {words.some((w) => w.state === 'folded') && (
                  <span>
                    <span className="said-folded">Faded</span> = said more directly in the prompt
                  </span>
                )}
              </p>
            )}
          </section>

          <FlowArrow active={working} />

          <section className="flow-step card" aria-labelledby="step-changed">
            <div className="step-head">
              <span className="step-num">2</span>
              <h2 id="step-changed">What changed</h2>
              {useClaude && claudeStatus && prompt && (
                <span className="soon-tag" role="status">
                  {claude.updating
                    ? 'Claude is refining…'
                    : claudePrompt
                      ? 'Refined by Claude'
                      : ''}
                </span>
              )}
            </div>
            {changes.length > 0 ? (
              <ul className="changes-list" aria-label="What changed">
                {changes.map((c, i) => (
                  <li key={c} style={{ animationDelay: `${i * 70}ms` }}>
                    <span aria-hidden="true">{claudePrompt ? '✦' : '✓'}</span> {c}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted step-empty">
                {heard
                  ? 'Nothing needed fixing.'
                  : 'Slips, filler and politeness get cleaned up here.'}
              </p>
            )}

            <div className="claude-toggle">
              <label className="check">
                <input
                  type="checkbox"
                  role="switch"
                  checked={useClaude && !!claudeStatus}
                  disabled={!claudeStatus}
                  onChange={(e) => setUseClaude(e.target.checked)}
                />
                <span>
                  Refine with Claude <span className="paid-tag">Paid</span>
                </span>
              </label>
              {claudeStatus ? (
                <p className="hint">
                  Understands corrections and context the built-in rules miss. Sends what you say to{' '}
                  {claudeStatus.modelLabel} each time you pause. About{' '}
                  {formatUsd(claudeStatus.typicalCostUsd)} per update, from a $
                  {claudeStatus.capUsd.toFixed(2)} daily {ownKey ? 'spending guard' : 'budget'}.
                  {useClaude && ` Spent this session: ${formatUsd(claude.spentUsd)}.`}
                </p>
              ) : (
                <p className="hint">
                  Understands corrections and context the built-in rules miss. Until it’s on, Studio
                  uses its built-in rules, which are free and stay in your browser.
                </p>
              )}
              {(ownKey || !claudeStatus) && <ApiKeyControl feature="Refine with Claude" />}
            </div>
            {claude.error && (
              <p className="error" role="alert">
                {claude.error}
              </p>
            )}
          </section>

          <FlowArrow active={working} />

          <section className="flow-step card score studio-result" aria-labelledby="step-prompt">
            <div className="step-head">
              <span className="step-num">3</span>
              <h2 id="step-prompt">Your prompt</h2>
              <button
                type="button"
                className="button primary small step-copy"
                onClick={() => void copyPrompt()}
                disabled={!prompt}
              >
                <span aria-live="polite">
                  {copy === 'copied' ? 'Copied' : copy === 'failed' ? 'Couldn’t copy' : 'Copy'}
                </span>
              </button>
            </div>

            {prompt ? (
              <div className="studio-prompt">
                {lines.map((line, i) => {
                  const label = LABEL_RE.exec(line);
                  return (
                    // Keyed by its text, so a new or changed line animates in.
                    <p key={line} className={label ? 'prompt-line prompt-label' : 'prompt-line'}>
                      {label ? (
                        <>
                          <span className="label-name">{label[1]}:</span> {label[2]}
                        </>
                      ) : (
                        line
                      )}
                      {i < lines.length - 1 ? '\n' : ''}
                    </p>
                  );
                })}
              </div>
            ) : (
              <p className="muted step-empty">Your prompt is built here, ready to copy.</p>
            )}

            {score && (
              <div className="score-head studio-score" aria-live="polite">
                <div className="ring-wrap">
                  <ScoreRing score={score.total} size={76} />
                  {gain > 0 && (
                    <span className="score-gain" key={score.total}>
                      +{gain}
                    </span>
                  )}
                </div>
                <div>
                  <p className={`band tone-${BAND_TONES[score.band]}`}>
                    <i className="tone-dot" aria-hidden="true" />
                    {BAND_LABELS[score.band]}
                  </p>
                  <p className="hint">Prompt quality, out of 100</p>
                </div>
              </div>
            )}
            {score && spoken.score && (
              <Impact bare={bare?.score ? bare : undefined} spoken={spoken} refined={analysis} />
            )}
            {score && (
              <div className="dialog-actions">
                <button type="button" className="button secondary small" onClick={openInWorkshop}>
                  Open in Workshop
                </button>
              </div>
            )}
          </section>
        </div>

        {/* The coach: what to say next. */}
        {score && (
          <section className="coach-row" aria-labelledby="coach-title">
            <h2 id="coach-title">
              {tips.length > 0 || claude.result?.question
                ? 'Say more to make it stronger'
                : 'Nothing left to add. This prompt is ready to send.'}
            </h2>
            <ul className="coach">
              {claude.result?.question && (
                <li className="coach-tip coach-question" key="q">
                  <span className="coach-who">Claude asks</span>
                  <strong>{claude.result.question}</strong>
                  <p className="fix">Answer out loud and it’s added to the prompt.</p>
                </li>
              )}
              {tips.map((t, i) => (
                <li key={t.id} className="coach-tip" style={{ animationDelay: `${i * 80}ms` }}>
                  <span className="points">+{t.points}</span>
                  <strong>{t.label}</strong>
                  <p className="fix">{t.say}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <details className="studio-options">
          <summary>Options and privacy</summary>
          <div className="controls">
            <div className="field">
              <span>Platform</span>
              <Segmented
                label="Platform"
                options={PLATFORM_OPTIONS}
                value={platform}
                onChange={setPlatform}
              />
            </div>
            <label className="field">
              <span>Use case</span>
              <select
                value={useCaseChoice}
                onChange={(e) => setUseCaseChoice(e.target.value as UseCase | 'auto')}
              >
                <option value="auto">Auto{heard ? ` (${USE_CASE_LABELS[useCase]})` : ''}</option>
                {USE_CASES.map((u) => (
                  <option key={u} value={u}>
                    {USE_CASE_LABELS[u]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="hint">
            Your browser turns speech into text. In Chrome and Edge that sends audio to the
            browser’s own speech service; Prompt IQ never receives or stores your audio or your
            words. Studio is in beta: check the prompt before you send it.
          </p>
        </details>
      </main>
    </div>
  );
}
