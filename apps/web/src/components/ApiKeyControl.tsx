import { useId, useRef, useState, type FormEvent } from 'react';
import { ApiRequestError, verifyApiKey } from '../lib/api';
import { checkApiKey, forgetApiKey, saveApiKey, useApiKey, type Remember } from '../lib/apiKey';

const WHERE: Record<Remember, string> = {
  tab: 'kept for this tab only',
  device: 'remembered on this device',
};

/**
 * Lets someone use the paid Claude features with their own Anthropic API key. The key is
 * checked with Anthropic, then kept in this browser only; the page never shows it again beyond
 * its last four characters.
 */
export function ApiKeyControl({ feature }: { feature: string }) {
  const saved = useApiKey();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputId = useId();
  const [value, setValue] = useState('');
  const [remember, setRemember] = useState<Remember>('tab');
  const [error, setError] = useState<string>();
  const [checking, setChecking] = useState(false);

  function open() {
    setValue('');
    setError(undefined);
    setRemember(saved?.remember ?? 'tab');
    dialogRef.current?.showModal();
  }

  function close() {
    // Don't leave a pasted key sitting in the form.
    setValue('');
    setError(undefined);
    dialogRef.current?.close();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const check = checkApiKey(value);
    if (!check.ok) return setError(check.message);
    setChecking(true);
    setError(undefined);
    try {
      await verifyApiKey(check.key);
      saveApiKey(check.key, remember);
      close();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Couldn’t check the key. Try again.');
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="key-control">
      {saved ? (
        <p className="hint">
          Using your Anthropic API key ending <code>…{saved.last4}</code> ({WHERE[saved.remember]}
          ).{' '}
          <button type="button" className="link-button" onClick={open}>
            Change
          </button>
          {' · '}
          <button type="button" className="link-button" onClick={forgetApiKey}>
            Forget key
          </button>
        </p>
      ) : (
        <p className="hint">
          <button type="button" className="button secondary small" onClick={open}>
            Add your Anthropic API key
          </button>{' '}
          to use {feature}. It’s billed to your own Anthropic account.
        </p>
      )}

      <dialog ref={dialogRef} className="confirm key-dialog" aria-labelledby={`${inputId}-title`}>
        <form onSubmit={(e) => void onSubmit(e)} autoComplete="off">
          <h3 id={`${inputId}-title`}>Use your own Anthropic API key</h3>
          <p>
            Paid Claude features are billed to your Anthropic account at Anthropic’s prices. Prompt
            IQ adds nothing on top.
          </p>
          <label className="field" htmlFor={inputId}>
            API key
            <input
              id={inputId}
              type="password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="sk-ant-…"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              // Ask password managers not to offer to save it.
              data-1p-ignore
              data-lpignore="true"
              aria-invalid={!!error || undefined}
              aria-describedby={error ? `${inputId}-error` : undefined}
            />
          </label>
          {error && (
            <p id={`${inputId}-error`} className="field-error" role="alert">
              {error}
            </p>
          )}
          <fieldset className="key-remember">
            <legend>Keep it</legend>
            <label className="check">
              <input
                type="radio"
                name={`${inputId}-remember`}
                checked={remember === 'tab'}
                onChange={() => setRemember('tab')}
              />
              <span>
                For this tab only <span className="muted">· forgotten when you close it</span>
              </span>
            </label>
            <label className="check">
              <input
                type="radio"
                name={`${inputId}-remember`}
                checked={remember === 'device'}
                onChange={() => setRemember('device')}
              />
              <span>
                On this device <span className="muted">· until you choose “Forget key”</span>
              </span>
            </label>
          </fieldset>
          <ul className="key-notes hint">
            <li>
              Your key stays in this browser and is sent only to Anthropic. Prompt IQ has no server
              that could receive it.
            </li>
            <li>
              Create a separate key for Prompt IQ and set a spending limit on it in the{' '}
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noreferrer"
              >
                Anthropic Console
              </a>
              . Don’t add a key on a shared computer.
            </li>
          </ul>
          <div className="dialog-actions">
            <button type="button" className="button secondary" onClick={close}>
              Cancel
            </button>
            <button type="submit" className="button primary" disabled={checking}>
              {checking ? 'Checking…' : 'Check and save'}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
