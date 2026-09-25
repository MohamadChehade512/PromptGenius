import type {
  RewriteRequest,
  RewriteResult,
  RewriteStatusResponse,
} from '@promptgenius/api-contract';
import { analyzePrompt, type AnalysisInput, type AnalysisResult } from '@promptgenius/core';
import { useRef, useState } from 'react';
import { ApiRequestError, streamRewrite } from '../lib/api';
import { formatUsd } from '../lib/format';
import { estimateRewriteUsd } from '../lib/rewriteEstimate';
import { readStorage, writeStorage } from '../lib/storage';

type State =
  | { kind: 'idle' }
  | { kind: 'running'; stage: 'starting' | 'thinking' | 'writing'; outputTokens: number }
  | { kind: 'done'; original: string; result: RewriteResult; costUsd: number; model: string }
  | { kind: 'error'; message: string; costUsd: number };

const CONFIRM_KEY = 'pg.rewrite.confirmed';

export function RewritePanel(props: {
  status: RewriteStatusResponse | undefined;
  onStatusChange: () => void;
  input: AnalysisInput;
  analysis: AnalysisResult;
  onUsePrompt: (text: string) => void;
}) {
  const { status, input, analysis } = props;
  const [state, setState] = useState<State>({ kind: 'idle' });
  const dialogRef = useRef<HTMLDialogElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const prompt = input.prompt.trim();
  const estimate = status ? estimateRewriteUsd(analysis.promptTokens.tokens, status) : 0;
  const running = state.kind === 'running';

  let disabledReason: string | null = null;
  if (!status) disabledReason = 'AI rewrite is unavailable (API offline).';
  else if (!status.enabled)
    disabledReason = 'AI rewrite is off: add ANTHROPIC_API_KEY to .env.local and restart.';
  else if (!prompt) disabledReason = 'Type a prompt first.';
  else if (status.remainingUsd <= 0)
    disabledReason = `Daily rewrite budget ($${status.capUsd}) reached. Resets at midnight UTC.`;
  else if (estimate > status.remainingUsd)
    disabledReason = 'Not enough daily budget left for this rewrite.';

  async function run() {
    if (!status) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ kind: 'running', stage: 'starting', outputTokens: 0 });
    const req: RewriteRequest = {
      platform: input.platform,
      targetModel: analysis.model.id,
      useCase: input.useCase,
      prompt,
      findings: (analysis.score?.findings ?? [])
        .filter((f) => !f.ruleId.startsWith('engine.'))
        .slice(0, 30)
        .map((f) => ({ ruleId: f.ruleId, suggestion: f.suggestion.slice(0, 500) })),
      // Names and types only: file contents never leave the browser.
      attachments: analysis.files.length
        ? analysis.files.slice(0, 10).map((f) => ({ name: f.name.slice(0, 200), kind: f.kind }))
        : undefined,
    };
    try {
      let finished = false;
      await streamRewrite(
        req,
        (e) => {
          if (e.type === 'progress')
            setState({ kind: 'running', stage: e.stage, outputTokens: e.outputTokens });
          if (e.type === 'result') {
            finished = true;
            setState({
              kind: 'done',
              original: prompt,
              result: e.result,
              costUsd: e.costUsd,
              model: e.model,
            });
          }
          if (e.type === 'error') {
            finished = true;
            setState({ kind: 'error', message: e.message, costUsd: e.costUsd });
          }
        },
        controller.signal,
      );
      if (!finished)
        setState({
          kind: 'error',
          message: 'The connection closed before the rewrite finished.',
          costUsd: 0,
        });
    } catch (err) {
      if (controller.signal.aborted) setState({ kind: 'error', message: 'Cancelled.', costUsd: 0 });
      else
        setState({
          kind: 'error',
          message: err instanceof ApiRequestError ? err.message : 'The rewrite request failed.',
          costUsd: 0,
        });
    } finally {
      abortRef.current = null;
      props.onStatusChange();
    }
  }

  function onClick() {
    if (readStorage('session', CONFIRM_KEY, false)) void run();
    else dialogRef.current?.showModal();
  }

  function onConfirm() {
    writeStorage('session', CONFIRM_KEY, true);
    dialogRef.current?.close();
    void run();
  }

  return (
    <section className="card rewrite" aria-labelledby="rewrite-title" data-tour="rewrite">
      <div className="rewrite-head">
        <div>
          <h2 id="rewrite-title">AI rewrite</h2>
          <p className="hint">
            Optional and <strong>paid</strong>. Sends your prompt
            {analysis.files.length > 0 ? ' and the names (not contents) of attached files' : ''} to
            the Claude API ({status?.modelLabel ?? 'Claude'}) to rewrite it for{' '}
            {analysis.model.label}. Everything else on this page is free.
          </p>
        </div>
        {running ? (
          <button
            type="button"
            className="button secondary"
            onClick={() => abortRef.current?.abort()}
          >
            Cancel
          </button>
        ) : (
          <button
            type="button"
            className="button primary"
            onClick={onClick}
            disabled={!!disabledReason}
            aria-describedby="rewrite-note"
          >
            ✨ Rewrite with AI · Paid · ≈ {formatUsd(estimate)}
          </button>
        )}
      </div>
      <p id="rewrite-note" className="hint">
        {disabledReason ??
          (status &&
            `Daily budget: ${formatUsd(status.spentUsd)} of $${status.capUsd.toFixed(2)} used today.`)}
      </p>

      {state.kind === 'running' && (
        <p className="progress" role="status">
          {state.stage === 'writing' ? `Writing… ~${state.outputTokens} tokens` : 'Thinking…'}
        </p>
      )}
      {state.kind === 'error' && (
        <p className="error" role="alert">
          {state.message}
          {state.costUsd > 0 && ` Billed for tokens already used: ${formatUsd(state.costUsd)}.`}
        </p>
      )}
      {state.kind === 'done' && (
        <RewriteResultView
          state={state}
          input={input}
          before={analysis}
          onUsePrompt={props.onUsePrompt}
        />
      )}

      <dialog ref={dialogRef} className="confirm" aria-labelledby="confirm-title">
        <h3 id="confirm-title">Use a paid AI rewrite?</h3>
        <p>
          This sends your prompt to the Claude API and costs about{' '}
          <strong>{formatUsd(estimate)}</strong> per rewrite, billed to the Anthropic account
          configured on this server. The exact cost is shown afterwards.
        </p>
        <p className="hint">
          Your prompt isn't stored or logged by PromptGenius. You'll only be asked once per session.
        </p>
        <div className="dialog-actions">
          <button
            type="button"
            className="button secondary"
            onClick={() => dialogRef.current?.close()}
          >
            Cancel
          </button>
          <button type="button" className="button primary" onClick={onConfirm}>
            Rewrite · ≈ {formatUsd(estimate)}
          </button>
        </div>
      </dialog>
    </section>
  );
}

function RewriteResultView(props: {
  state: Extract<State, { kind: 'done' }>;
  input: AnalysisInput;
  before: AnalysisResult;
  onUsePrompt: (text: string) => void;
}) {
  const { state, input, before } = props;
  const [copied, setCopied] = useState(false);
  // Re-scored with the same free local engine, so before/after are directly comparable.
  const after = analyzePrompt({
    ...input,
    prompt: state.result.rewritten_prompt,
    exactPromptTokens: undefined,
  });
  const beforeTokens = before.promptTokens.tokens;
  const afterTokens = after.promptTokens.tokens;
  const delta = (a: number, b: number) => (b - a >= 0 ? `+${b - a}` : String(b - a));

  return (
    <div className="rewrite-result">
      <p className="cost-note">
        This rewrite cost <strong>{formatUsd(state.costUsd)}</strong> ({state.model}).
      </p>
      <div className="compare">
        <div>
          <h3>
            Original · score {before.score?.total ?? 0} · ~{beforeTokens} tokens
          </h3>
          <pre>{state.original}</pre>
        </div>
        <div>
          <h3>
            Rewritten · score {after.score?.total ?? 0} (
            {delta(before.score?.total ?? 0, after.score?.total ?? 0)}) · ~{afterTokens} tokens (
            {delta(beforeTokens, afterTokens)})
          </h3>
          <pre>{state.result.rewritten_prompt}</pre>
        </div>
      </div>
      <p className="hint">
        Estimated cost per call on {before.model.label}: {formatUsd(before.cost.mid)} →{' '}
        {formatUsd(after.cost.mid)}.
      </p>
      {state.result.changes.length > 0 && (
        <>
          <h3>What changed</h3>
          <ul className="changes">
            {state.result.changes.map((c, i) => (
              <li key={i}>
                <strong>{c.change}</strong> {c.reason}
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="dialog-actions">
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            void navigator.clipboard
              ?.writeText(state.result.rewritten_prompt)
              .then(() => setCopied(true));
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button
          type="button"
          className="button primary"
          onClick={() => props.onUsePrompt(state.result.rewritten_prompt)}
        >
          Use this prompt
        </button>
      </div>
    </div>
  );
}
