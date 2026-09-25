/** Browser storage can throw (private mode, blocked site data); never let that break the app. */
export function readStorage<T>(storage: 'local' | 'session', key: string, fallback: T): T {
  try {
    const raw = (storage === 'local' ? window.localStorage : window.sessionStorage).getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeStorage(storage: 'local' | 'session', key: string, value: unknown): void {
  try {
    (storage === 'local' ? window.localStorage : window.sessionStorage).setItem(
      key,
      JSON.stringify(value),
    );
  } catch {
    // Non-essential convenience only.
  }
}
