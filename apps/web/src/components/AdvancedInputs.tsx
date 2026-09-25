export function AdvancedInputs(props: {
  systemPrompt: string;
  onSystemPrompt: (v: string) => void;
  attachmentTokens: number;
  onAttachmentTokens: (n: number) => void;
  turns: number;
  onTurns: (n: number) => void;
}) {
  const int = (v: string, max: number) => Math.min(max, Math.max(0, Math.floor(Number(v) || 0)));
  return (
    <details className="card advanced-inputs">
      <summary>Session inputs: system prompt, other content, turns</summary>
      <label className="field">
        <span>System prompt (resent every turn)</span>
        <textarea
          value={props.systemPrompt}
          onChange={(e) => props.onSystemPrompt(e.target.value)}
          rows={4}
          placeholder="Optional: instructions sent as the system/developer message."
        />
      </label>
      <div className="row">
        <label className="field">
          <span>Other resent content (tokens)</span>
          <input
            type="number"
            min={0}
            max={2_000_000}
            step={1000}
            value={props.attachmentTokens}
            onChange={(e) => props.onAttachmentTokens(int(e.target.value, 2_000_000))}
          />
        </label>
        <label className="field">
          <span>Conversation turns</span>
          <input
            type="number"
            min={1}
            max={200}
            value={props.turns}
            onChange={(e) => props.onTurns(Math.max(1, int(e.target.value, 200)))}
          />
        </label>
      </div>
    </details>
  );
}
