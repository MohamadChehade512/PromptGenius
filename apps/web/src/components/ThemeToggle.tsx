import { useEffect, useState } from 'react';
import {
  applyThemeChoice,
  onSystemThemeChange,
  readThemeChoice,
  saveThemeChoice,
  systemTheme,
  type Theme,
} from '../lib/theme';

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <circle cx="12" cy="12" r="4.5" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
      </g>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5a8.5 8.5 0 1 0 11.1 11.1Z" fill="currentColor" />
    </svg>
  );
}

/**
 * Light/dark switch. Until the user picks, the page follows the system setting (and
 * keeps following it); a pick is remembered in this browser.
 */
export function ThemeToggle() {
  const [choice, setChoice] = useState<Theme | null>(() => readThemeChoice());
  const [system, setSystem] = useState<Theme>(() => systemTheme());
  const theme = choice ?? system;
  const dark = theme === 'dark';

  useEffect(() => onSystemThemeChange(setSystem), []);
  useEffect(() => applyThemeChoice(choice), [choice]);

  function toggle() {
    const next: Theme = dark ? 'light' : 'dark';
    saveThemeChoice(next);
    setChoice(next);
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Dark mode"
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="theme-toggle"
      onClick={toggle}
    >
      <span className="theme-toggle-thumb">{dark ? <MoonIcon /> : <SunIcon />}</span>
    </button>
  );
}
