import { CONVERSATION_PRESETS, EXCHANGE_TOKENS } from '@promptgenius/core';
import { formatTokens } from '../lib/format';

const CUSTOM = 'custom';

/**
 * How much of the conversation is already used. Every message resends it, so it
 * drives cost, usage limits and how full the context window is.
 */
export function ConversationInput(props: { tokens: number; onChange: (tokens: number) => void }) {
  const preset = CONVERSATION_PRESETS.find((p) => p.tokens === props.tokens);
  const selected = preset ? preset.id : CUSTOM;

  return (
    <div className="conversation" data-tour="conversation">
      <label className="field">
        <span>Conversation so far</span>
        <select
          value={selected}
          onChange={(e) => {
            const p = CONVERSATION_PRESETS.find((x) => x.id === e.target.value);
            props.onChange(p ? p.tokens : props.tokens || 10_000);
          }}
        >
          {CONVERSATION_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
              {p.tokens ? ` · ${formatTokens(p.tokens)} tokens` : ''}
            </option>
          ))}
          <option value={CUSTOM}>Custom amount…</option>
        </select>
      </label>
      {selected === CUSTOM && (
        <label className="field">
          <span>Tokens already in the chat</span>
          <input
            type="number"
            min={0}
            max={2_000_000}
            step={1000}
            value={props.tokens}
            onChange={(e) =>
              props.onChange(
                Math.min(2_000_000, Math.max(0, Math.floor(Number(e.target.value) || 0))),
              )
            }
          />
        </label>
      )}
      <p className="hint">
        Every message resends the whole conversation, so earlier messages count toward cost, usage
        limits and the context window. One back-and-forth is roughly{' '}
        {EXCHANGE_TOKENS.toLocaleString()} tokens.
      </p>
    </div>
  );
}
