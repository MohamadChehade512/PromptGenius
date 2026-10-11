import type { StudioRefineResult, StudioStatusResponse } from '@promptgenius/api-contract';
import type { PlatformId } from '@promptgenius/core';
import { useEffect, useRef, useState } from 'react';
import { ApiRequestError, getStudioStatus, refineStudio } from '../lib/api';
import { useApiKey } from '../lib/apiKey';

/**
 * Whether Studio's paid Claude refine can run (through the server, or with the person's own
 * API key), and its price. Undefined: it can't.
 */
export function useStudioStatus(): StudioStatusResponse | undefined {
  const [status, setStatus] = useState<StudioStatusResponse>();
  const hasKey = !!useApiKey();
  useEffect(() => {
    const controller = new AbortController();
    getStudioStatus(controller.signal)
      .then((s) => setStatus(s.enabled ? s : undefined))
      .catch(() => setStatus(undefined));
    return () => controller.abort();
  }, [hasKey]);
  return status;
}

interface Refined {
  /** The transcript this result is for. */
  transcript: string;
  result: StudioRefineResult;
}

/**
 * PAID. While `enabled`, sends the transcript to Claude each time the speaker pauses and
 * returns the latest refined prompt. A newer transcript cancels the request in flight, and the
 * same transcript is never sent twice.
 */
export function useStudioRefine(opts: {
  enabled: boolean;
  transcript: string;
  platform: PlatformId;
  /** What the scorer found missing in the rule-refined prompt. */
  gaps: string[];
  /** How long to wait after the last change before calling. */
  delayMs?: number;
}) {
  const { enabled, platform } = opts;
  const transcript = opts.transcript.trim();
  const [refined, setRefined] = useState<Refined>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [spentUsd, setSpentUsd] = useState(0);
  const gaps = useRef(opts.gaps);
  useEffect(() => {
    gaps.current = opts.gaps;
  }, [opts.gaps]);

  const worthSending = enabled && transcript.split(/\s+/).length >= 3;
  const upToDate = refined?.transcript === transcript;

  useEffect(() => {
    if (!worthSending || upToDate) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setPending(true);
      setError(undefined);
      refineStudio({ platform, transcript, gaps: gaps.current }, controller.signal)
        .then((res) => {
          setRefined({ transcript, result: res.result });
          setSpentUsd((s) => s + res.costUsd);
          setPending(false);
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          setPending(false);
          setError(
            err instanceof ApiRequestError
              ? err.message
              : 'Claude couldn’t be reached. Showing the built-in version.',
          );
        });
    }, opts.delayMs ?? 900);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [worthSending, upToDate, transcript, platform, opts.delayMs]);

  return {
    /** Claude's latest result (possibly for slightly older speech while a newer one loads). */
    result: enabled && transcript ? refined?.result : undefined,
    /** A request is waiting or in flight for the current speech. */
    updating: worthSending && !upToDate && !error ? true : pending && worthSending,
    error: enabled ? error : undefined,
    spentUsd,
  };
}
