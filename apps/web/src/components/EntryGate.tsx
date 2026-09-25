import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react';
import {
  EMAIL_MAX,
  NAME_MAX,
  clearAgreement,
  readAgreement,
  saveAgreement,
  validateEmail,
  validateName,
  type Agreement,
} from '../lib/agreement';
import { Wordmark } from './Logo';
import { TermsText } from './TermsText';

function LoadingScreen() {
  return (
    <div className="entry entry-loading" role="status" aria-live="polite">
      <div className="entry-brand">
        <Wordmark size={44} />
      </div>
      <div className="entry-progress" aria-hidden="true">
        <span />
      </div>
      <span className="entry-status">Loading PromptGenius…</span>
    </div>
  );
}

function TermsScreen({ onAgree }: { onAgree: (a: Agreement) => void }) {
  const titleId = useId();
  const termsId = useId();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const nameError = validateName(name);
  const emailError = validateEmail(email);
  const agreeError = agreed ? null : 'Tick the box to agree to the terms.';
  const show = (error: string | null) => (submitted ? error : null);

  function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (nameError || emailError || agreeError) return;
    onAgree(saveAgreement(name, email));
  }

  return (
    <main className="entry entry-terms" aria-labelledby={titleId}>
      <div className="entry-card card">
        <div className="entry-brand">
          <Wordmark size={36} />
        </div>
        <h1 id={titleId}>Before you start</h1>
        <p className="tagline">
          Please read the terms of use, then enter your name and email and agree to continue.
        </p>

        <section
          className="terms"
          id={termsId}
          aria-label="Terms of use"
          // Scrollable region: focusable so keyboard users can scroll it.
          tabIndex={0}
        >
          <h2>Terms of use</h2>
          <TermsText />
        </section>

        <form className="entry-form" onSubmit={submit} noValidate>
          <div className="row">
            <label className="field">
              <span>Name</span>
              <input
                type="text"
                autoComplete="name"
                maxLength={NAME_MAX}
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={!!show(nameError)}
              />
              {show(nameError) && <span className="field-error">{nameError}</span>}
            </label>
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                autoComplete="email"
                inputMode="email"
                maxLength={EMAIL_MAX}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!show(emailError)}
              />
              {show(emailError) && <span className="field-error">{emailError}</span>}
            </label>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              aria-invalid={!!show(agreeError)}
              aria-describedby={termsId}
            />
            <span>I have read and agree to the terms of use.</span>
          </label>
          {show(agreeError) && <span className="field-error">{agreeError}</span>}
          <p className="hint">
            Your name and email are saved only in this browser, as a record that you agreed. They
            aren't sent anywhere.
          </p>
          <div className="dialog-actions">
            <button type="submit" className="button primary">
              Agree and continue
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

/**
 * Entry flow: a short loading screen, then the terms (name, email, agree) unless this
 * browser already agreed to the current version, then the app.
 */
export function EntryGate(props: {
  children: (agreement: Agreement, withdraw: () => void) => ReactNode;
  /** How long the loading screen shows at least; 0 in tests. */
  minLoadingMs?: number;
}) {
  const minLoadingMs = props.minLoadingMs ?? 900;
  const [loaded, setLoaded] = useState(false);
  const [agreement, setAgreement] = useState<Agreement | null>(() => readAgreement());

  useEffect(() => {
    const t = window.setTimeout(() => setLoaded(true), minLoadingMs);
    return () => window.clearTimeout(t);
  }, [minLoadingMs]);

  if (!loaded) return <LoadingScreen />;
  if (!agreement) return <TermsScreen onAgree={setAgreement} />;
  return props.children(agreement, () => {
    clearAgreement();
    setAgreement(null);
  });
}
