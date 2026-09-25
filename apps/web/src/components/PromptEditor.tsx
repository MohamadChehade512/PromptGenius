import { LIMITS } from '@promptgenius/api-contract';

export function PromptEditor(props: {
  value: string;
  onChange: (value: string) => void;
  chars: number;
  words: number;
}) {
  return (
    <div className="editor" data-tour="prompt">
      <label htmlFor="prompt" className="editor-label">
        Your prompt
      </label>
      <textarea
        id="prompt"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder="Type or paste a prompt. Tokens, cost and a score update as you type."
        spellCheck
        maxLength={LIMITS.countChars}
        rows={12}
      />
      <div className="editor-footer">
        <span>
          {props.chars.toLocaleString()} characters · {props.words.toLocaleString()} words
        </span>
        {props.value && (
          <button type="button" className="link-button" onClick={() => props.onChange('')}>
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
