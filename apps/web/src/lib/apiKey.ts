import { useSyncExternalStore } from 'react';

/**
 * The person's own Anthropic API key, for the optional paid Claude features.
 *
 * It stays in this browser: by default in sessionStorage (gone when the tab closes), or in
 * localStorage if they choose "remember on this device". It is only ever sent to
 * api.anthropic.com as a request header (the site's Content-Security-Policy allows no other
 * outside address), never put in a URL, never logged, and never shown in full again.
 */
const STORAGE_KEY = 'pg.anthropicKey';
export type Remember = 'tab' | 'device';

/** Anthropic keys: "sk-ant-" then letters, digits, dashes and underscores. */
const KEY_RE = /^sk-ant-[A-Za-z0-9_-]{20,}$/;

// Used when browser storage is blocked, so the key still works until the page is left.
let memory: { key: string; remember: Remember } | null = null;
const listeners = new Set<() => void>();

function storage(kind: Remember): Storage | undefined {
  try {
    return kind === 'device' ? window.localStorage : window.sessionStorage;
  } catch {
    return undefined;
  }
}

function read(kind: Remember): string | null {
  try {
    const value = storage(kind)?.getItem(STORAGE_KEY) ?? null;
    return value && KEY_RE.test(value) ? value : null;
  } catch {
    return null;
  }
}

function clear(kind: Remember): void {
  try {
    storage(kind)?.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}

function current(): { key: string; remember: Remember } | null {
  const tab = read('tab');
  if (tab) return { key: tab, remember: 'tab' };
  const device = read('device');
  if (device) return { key: device, remember: 'device' };
  return memory;
}

/** The key itself. Only the code that calls Anthropic should ask for this. */
export function readApiKey(): string | null {
  return current()?.key ?? null;
}

export function hasApiKey(): boolean {
  return current() !== null;
}

export type KeyCheck = { ok: true; key: string } | { ok: false; message: string };

/** Checks the shape of a pasted key, without contacting anyone. */
export function checkApiKey(raw: string): KeyCheck {
  const key = raw.trim();
  if (!key) return { ok: false, message: 'Paste your Anthropic API key.' };
  if (key.startsWith('sk-ant-admin'))
    return {
      ok: false,
      message: 'That’s an admin key, which can manage your whole account. Use a regular API key.',
    };
  if (!KEY_RE.test(key))
    return { ok: false, message: 'That doesn’t look like an Anthropic API key (sk-ant-…).' };
  return { ok: true, key };
}

export function saveApiKey(key: string, remember: Remember): void {
  // Only ever kept in one place.
  clear('tab');
  clear('device');
  memory = { key, remember };
  try {
    storage(remember)?.setItem(STORAGE_KEY, key);
  } catch {
    // Storage is blocked: the in-memory copy lasts until the page is left.
  }
  listeners.forEach((l) => l());
}

export function forgetApiKey(): void {
  clear('tab');
  clear('device');
  memory = null;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Forgetting the key in one tab forgets it in the others.
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

/** What the page may show about the key: its last four characters and where it's kept. */
function snapshot(): string {
  const c = current();
  return c ? `${c.remember}:${c.key.slice(-4)}` : '';
}

export function useApiKey(): { last4: string; remember: Remember } | null {
  const s = useSyncExternalStore(subscribe, snapshot, () => '');
  if (!s) return null;
  const [remember, last4] = s.split(':') as [Remember, string];
  return { last4, remember };
}
