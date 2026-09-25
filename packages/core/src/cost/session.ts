import type { ModelSpec } from '../config';
import { callCost } from './cost';

export interface SessionInput {
  model: ModelSpec;
  /** System prompt + tool definitions + attachments: resent on every turn. */
  fixedTokens: number;
  userTokensPerTurn: number;
  assistantTokensPerTurn: number;
  thinkingTokensPerTurn: number;
  turns: number;
  /** An ongoing chat's history was already sent (and cached) on the previous turn. */
  prefixCached?: boolean;
  /**
   * Part of fixedTokens that is new on turn 1 (files attached to this message), so it
   * can't be read from the cache until turn 2 even when the rest of the prefix can.
   */
  firstTurnNewTokens?: number;
}

export interface SessionTurn {
  turn: number;
  inputTokens: number;
  /** Context occupied after this turn's answer. */
  contextTokens: number;
  costUncached: number;
  costCached: number;
  cumulativeUncached: number;
  cumulativeCached: number;
}

export interface SessionProjection {
  turns: SessionTurn[];
  /** How many turns fit before the context window is full (Infinity if more than simulated). */
  turnsUntilFull: number;
  contextWindow: number;
  /** Prefixes shorter than this are never cached (model-specific). */
  cacheMinTokens: number;
  /** False when the resent prefix never reaches the cache minimum, so caching changes nothing. */
  cachingApplies: boolean;
}

/**
 * Every turn resends the whole history, so input grows linearly per turn and total cost
 * grows quadratically. With caching, the prefix already sent last turn is billed at the
 * cache-read rate and only the new part is written (Claude/OpenAI charge a write premium;
 * Gemini's implicit cache doesn't). Thinking tokens are billed once and not carried over.
 */
export function projectSession(s: SessionInput): SessionProjection {
  const exchange = s.userTokensPerTurn + s.assistantTokensPerTurn;
  const out: SessionTurn[] = [];
  let cumU = 0;
  let cumC = 0;

  for (let k = 1; k <= s.turns; k++) {
    const prefix = s.fixedTokens + (k - 1) * exchange;
    const inputTokens = prefix + s.userTokensPerTurn;
    const base = {
      inputTokens,
      outputTokens: s.assistantTokensPerTurn,
      thinkingTokens: s.thinkingTokensPerTurn,
    };
    const uncached = callCost(s.model, base).total;

    const cachedPrefix = k === 1 ? prefix - (s.firstTurnNewTokens ?? 0) : prefix;
    const canRead = (k > 1 || !!s.prefixCached) && cachedPrefix >= s.model.cacheMinTokens;
    const read = canRead ? cachedPrefix : 0;
    const write = inputTokens >= s.model.cacheMinTokens ? inputTokens - read : 0;
    const cached = callCost(s.model, {
      ...base,
      cacheReadTokens: read,
      cacheWriteTokens: write,
    }).total;

    cumU += uncached;
    cumC += cached;
    out.push({
      turn: k,
      inputTokens,
      contextTokens: inputTokens + s.assistantTokensPerTurn + s.thinkingTokensPerTurn,
      costUncached: uncached,
      costCached: cached,
      cumulativeUncached: cumU,
      cumulativeCached: cumC,
    });
  }

  const perTurnGrowth = exchange;
  const room = s.model.contextWindow - s.fixedTokens - s.thinkingTokensPerTurn;
  const turnsUntilFull =
    perTurnGrowth > 0 ? Math.max(0, Math.floor(room / perTurnGrowth)) : Infinity;

  const last = out[out.length - 1];
  return {
    turns: out,
    turnsUntilFull,
    contextWindow: s.model.contextWindow,
    cacheMinTokens: s.model.cacheMinTokens,
    cachingApplies: !!last && last.cumulativeCached < last.cumulativeUncached * 0.999,
  };
}
