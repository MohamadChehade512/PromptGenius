import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { EntryGate } from './components/EntryGate';
import { applyThemeChoice, readThemeChoice } from './lib/theme';
import './styles.css';

// Apply a saved light/dark choice before the first paint.
applyThemeChoice(readThemeChoice());

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <EntryGate>
      {(agreement, withdraw) => <App agreement={agreement} onWithdraw={withdraw} />}
    </EntryGate>
  </StrictMode>,
);
