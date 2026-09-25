import {
  MODELS_CONFIG,
  PLATFORMS,
  PLATFORM_LABELS,
  analyzePrompt,
  getDefaultModel,
  listConsumerPlans,
  resolveEffort,
  resolveModel,
  type AnalysisInput,
  type EffortLevel,
  type Mode,
  type PlatformId,
  type UseCase,
} from '@promptgenius/core';
import { useDeferredValue, useMemo, useState } from 'react';
import { AdvancedInputs } from './components/AdvancedInputs';
import { AttachmentsInput } from './components/AttachmentsInput';
import { Wordmark } from './components/Logo';
import { Controls } from './components/Controls';
import { ConversationInput } from './components/ConversationInput';
import { PromptEditor } from './components/PromptEditor';
import { RewritePanel } from './components/RewritePanel';
import { ScorePanel } from './components/ScorePanel';
import { ThemeToggle } from './components/ThemeToggle';
import { Tutorial } from './components/Tutorial';
import { Segmented } from './components/Segmented';
import { UsagePanel } from './components/UsagePanel';
import { useAttachments } from './hooks/useAttachments';
import { useExactTokenCount } from './hooks/useExactTokenCount';
import { useHealth } from './hooks/useHealth';
import { usePersistentState } from './hooks/usePersistentState';
import { useRewriteStatus } from './hooks/useRewriteStatus';
import type { Agreement } from './lib/agreement';
import { readStorage, writeStorage } from './lib/storage';
import { BAND_TONES } from './lib/scoreTone';

type PerPlatform<T> = Record<PlatformId, T>;
const perPlatform = <T,>(f: (p: PlatformId) => T) =>
  Object.fromEntries(PLATFORMS.map((p) => [p, f(p)])) as PerPlatform<T>;

const MODES = [
  { value: 'simple', label: 'Simple' },
  { value: 'advanced', label: 'Advanced' },
] as const satisfies readonly { value: Mode; label: string }[];
const PLATFORM_OPTIONS = PLATFORMS.map((p) => ({ value: p, label: PLATFORM_LABELS[p] }));
const TUTORIAL_KEY = 'pg.tutorialDone';

export function App(props: { agreement?: Agreement; onWithdraw?: () => void } = {}) {
  // Settings persist per browser; the prompt and attached files stay in memory only.
  const [mode, setMode] = usePersistentState<Mode>('pg.mode', 'simple');
  const [platform, setPlatform] = usePersistentState<PlatformId>('pg.platform', 'claude');
  const [useCase, setUseCase] = usePersistentState<UseCase>('pg.useCase', 'qa');
  const [models, setModels] = usePersistentState(
    'pg.models',
    perPlatform((p) => getDefaultModel(p).id),
  );
  const [efforts, setEfforts] = usePersistentState<PerPlatform<EffortLevel | null>>(
    'pg.efforts',
    perPlatform(() => null),
  );
  const [plans, setPlans] = usePersistentState(
    'pg.plans',
    perPlatform((p) => listConsumerPlans(p).at(-1)!.id),
  );
  const [turns, setTurns] = usePersistentState('pg.turns', 10);
  const [attachmentTokens, setAttachmentTokens] = usePersistentState('pg.attachments', 0);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [historyTokens, setHistoryTokens] = useState(0);
  const [prompt, setPrompt] = useState('');
  const files = useAttachments();
  // The tour runs once, right after someone first agrees to the terms; replayable from the footer.
  const [touring, setTouring] = useState(
    () => !!props.agreement && !readStorage('local', TUTORIAL_KEY, false),
  );
  const endTour = () => {
    writeStorage('local', TUTORIAL_KEY, true);
    setTouring(false);
  };

  const advanced = mode === 'advanced';
  const health = useHealth();
  const online = health.state === 'online';
  const features = online ? health.data.features : undefined;
  const { status: rewriteStatus, refresh: refreshRewrite } = useRewriteStatus(online);

  const model = resolveModel(platform, models[platform]);
  const effort = resolveEffort(model, efforts[platform] ?? undefined);
  const serverCount =
    platform === 'claude'
      ? !!features?.countClaude
      : platform === 'gemini' && !!features?.countGemini;

  const deferredPrompt = useDeferredValue(prompt);
  const promptCount = useExactTokenCount({
    platform,
    model: model.id,
    text: deferredPrompt,
    serverAvailable: serverCount,
  });
  const systemCount = useExactTokenCount({
    platform,
    model: model.id,
    text: advanced ? systemPrompt : '',
    serverAvailable: serverCount,
  });

  const planId = plans[platform];
  const input = useMemo<AnalysisInput>(
    () => ({
      platform,
      useCase,
      mode,
      prompt: deferredPrompt,
      modelId: model.id,
      effort,
      systemPrompt,
      attachmentTokens,
      turns,
      planId,
      historyTokens,
      attachments: files.attachments,
      exactPromptTokens: promptCount.count,
      exactSystemTokens: systemCount.count?.tokens,
    }),
    [
      platform,
      useCase,
      mode,
      deferredPrompt,
      model.id,
      effort,
      systemPrompt,
      attachmentTokens,
      turns,
      planId,
      historyTokens,
      files.attachments,
      promptCount.count,
      systemCount.count,
    ],
  );
  const analysis = useMemo(() => analyzePrompt(input), [input]);
  // No score (empty prompt) means no tone: the page stays neutral until something is typed.
  const tone = analysis.score ? BAND_TONES[analysis.score.band] : undefined;

  return (
    <div className="shell" data-tone={tone}>
      <header className="top">
        <div>
          <h1>
            <Wordmark size={34} />
          </h1>
          <p className="tagline">Build better prompts for Claude, ChatGPT and Gemini.</p>
        </div>
        <div className="top-controls">
          <div data-tour="mode">
            <Segmented label="Detail level" options={MODES} value={mode} onChange={setMode} />
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="layout">
        <div className="col-main">
          <section className="card" aria-label="Target" data-tour="target">
            <Segmented
              label="Platform"
              options={PLATFORM_OPTIONS}
              value={platform}
              onChange={setPlatform}
              size="lg"
            />
            <Controls
              advanced={advanced}
              platform={platform}
              useCase={useCase}
              onUseCase={setUseCase}
              model={model}
              onModel={(id) => setModels({ ...models, [platform]: id })}
              effort={effort}
              onEffort={(e) => setEfforts({ ...efforts, [platform]: e })}
              planId={planId}
              onPlan={(id) => setPlans({ ...plans, [platform]: id })}
            />
          </section>

          <section className="card">
            <PromptEditor
              value={prompt}
              onChange={setPrompt}
              chars={analysis.chars}
              words={analysis.words}
            />
            <AttachmentsInput
              items={files.items}
              tokens={analysis.files}
              onAdd={files.add}
              onRemove={files.remove}
              simple={!advanced}
            />
            <ConversationInput tokens={historyTokens} onChange={setHistoryTokens} />
          </section>

          {advanced && (
            <AdvancedInputs
              systemPrompt={systemPrompt}
              onSystemPrompt={setSystemPrompt}
              attachmentTokens={attachmentTokens}
              onAttachmentTokens={setAttachmentTokens}
              turns={turns}
              onTurns={setTurns}
            />
          )}

          <RewritePanel
            status={rewriteStatus}
            onStatusChange={refreshRewrite}
            input={input}
            analysis={analysis}
            onUsePrompt={setPrompt}
          />
        </div>

        <div className="col-side">
          <ScorePanel score={analysis.score} advanced={advanced} />
          <UsagePanel
            a={analysis}
            advanced={advanced}
            exactStatus={promptCount.status}
            lastVerified={MODELS_CONFIG.lastVerified}
          />
        </div>
      </main>

      <footer className="bottom">
        <span className={`status status-${health.state}`}>API: {health.state}</span>
        <span>Your prompts are never stored or logged. Estimates are guidance, not bills.</span>
        <button type="button" className="link-button" onClick={() => setTouring(true)}>
          Show tutorial
        </button>
        {props.agreement && (
          <span>
            Agreed to the terms as {props.agreement.name}
            {props.onWithdraw && (
              <>
                {' · '}
                <button type="button" className="link-button" onClick={props.onWithdraw}>
                  Withdraw and delete my details
                </button>
              </>
            )}
          </span>
        )}
      </footer>
      {touring && <Tutorial onClose={endTour} />}
    </div>
  );
}
