import { readStorage, writeStorage } from './storage';

export type Theme = 'light' | 'dark';

const KEY = 'pg.theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

/** The user's explicit choice, or null to follow the system setting. */
export function readThemeChoice(): Theme | null {
  const t = readStorage<unknown>('local', KEY, null);
  return t === 'light' || t === 'dark' ? t : null;
}

export function saveThemeChoice(theme: Theme): void {
  writeStorage('local', KEY, theme);
}

export function systemTheme(): Theme {
  return window.matchMedia?.(DARK_QUERY).matches ? 'dark' : 'light';
}

/** Calls back when the system setting changes; returns an unsubscribe function. */
export function onSystemThemeChange(cb: (t: Theme) => void): () => void {
  const mq = window.matchMedia?.(DARK_QUERY);
  if (!mq) return () => {};
  const handler = (e: MediaQueryListEvent) => cb(e.matches ? 'dark' : 'light');
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}

/**
 * styles.css keys its tokens off `data-theme` on <html>; without it, the system setting
 * applies. Set before the first render (main.tsx) so a saved choice never flashes.
 */
export function applyThemeChoice(choice: Theme | null): void {
  const root = document.documentElement;
  if (choice) root.dataset.theme = choice;
  else delete root.dataset.theme;
}
