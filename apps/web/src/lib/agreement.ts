import { readStorage, writeStorage } from './storage';

/**
 * Bump this whenever the terms change: everyone is asked to agree again. Keep it in step
 * with the "Last updated" date shown in the terms.
 */
export const TERMS_VERSION = '2026-09-24';

export interface Agreement {
  name: string;
  email: string;
  termsVersion: string;
  agreedAt: string;
}

const KEY = 'pg.agreement';

/**
 * The agreement lives only in this browser's localStorage, as a record that this person
 * agreed. It isn't sent to the server: accounts (and server-side records) are Phase 2.
 */
export function readAgreement(): Agreement | null {
  const a = readStorage<Partial<Agreement> | null>('local', KEY, null);
  if (!a || a.termsVersion !== TERMS_VERSION) return null;
  if (validateName(a.name ?? '') || validateEmail(a.email ?? '')) return null;
  return a as Agreement;
}

export function saveAgreement(name: string, email: string): Agreement {
  const agreement: Agreement = {
    name: name.trim(),
    email: email.trim(),
    termsVersion: TERMS_VERSION,
    agreedAt: new Date().toISOString(),
  };
  writeStorage('local', KEY, agreement);
  return agreement;
}

export function clearAgreement(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: nothing was saved, so there's nothing to clear.
  }
}

export const NAME_MAX = 100;
export const EMAIL_MAX = 254;

/** Returns an error message, or null when valid. */
export function validateName(name: string): string | null {
  const n = name.trim();
  if (!n) return 'Enter your name.';
  if (n.length > NAME_MAX) return `Use ${NAME_MAX} characters or fewer.`;
  return null;
}

// Deliberately simple: one @, no spaces, a dot in the domain. Real verification needs an
// email round-trip (Phase 2, Cognito).
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)*\.[^\s@.]{2,}$/;

export function validateEmail(email: string): string | null {
  const e = email.trim();
  if (!e) return 'Enter your email address.';
  if (e.length > EMAIL_MAX || !EMAIL_RE.test(e))
    return 'Enter a valid email, like name@example.com.';
  return null;
}
