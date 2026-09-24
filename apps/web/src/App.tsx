import { PLATFORMS, PLATFORM_LABELS } from '@promptgenius/core';
import { useEffect, useState } from 'react';
import { getHealth } from './api';

type ApiStatus = 'checking' | 'online' | 'offline';

export function App() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking');

  useEffect(() => {
    const controller = new AbortController();
    getHealth(controller.signal)
      .then(() => setApiStatus('online'))
      .catch(() => {
        if (!controller.signal.aborted) setApiStatus('offline');
      });
    return () => controller.abort();
  }, []);

  return (
    <main className="shell">
      <header>
        <h1>PromptGenius</h1>
        <p className="tagline">
          Build better prompts for {PLATFORMS.map((p) => PLATFORM_LABELS[p]).join(', ')}.
        </p>
      </header>

      <section className="canvas" aria-label="Workspace">
        <p>Phase 0: blank canvas. The prompt workspace arrives in Phase 1.</p>
      </section>

      <footer>
        <span className={`status status-${apiStatus}`}>API: {apiStatus}</span>
      </footer>
    </main>
  );
}
