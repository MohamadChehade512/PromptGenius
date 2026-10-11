import { readStorage } from './storage';

/** A prompt handed from Prompt Studio to the Workshop: kept for this tab only, read once. */
export const HANDOFF_KEY = 'pg.handoff';

export function takeHandoff(): string {
  const prompt = readStorage<string>('session', HANDOFF_KEY, '');
  try {
    window.sessionStorage.removeItem(HANDOFF_KEY);
  } catch {
    // Non-essential.
  }
  return typeof prompt === 'string' ? prompt : '';
}
