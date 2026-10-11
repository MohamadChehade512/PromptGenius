import { ThemeToggle } from '../components/ThemeToggle';
import { Wordmark } from '../components/Logo';
import { linkClick } from '../lib/router';

/** The site's top bar: wordmark, the three sections, and the theme switch. */
export function SiteHeader({ path }: { path: string }) {
  const current = (to: string) => (path === to ? ('page' as const) : undefined);
  return (
    <header className="top">
      <a href="/" className="brand" onClick={linkClick('/')} aria-label="Prompt IQ home">
        <Wordmark />
        <span className="beta-badge">Beta</span>
      </a>
      <nav className="site-nav" aria-label="Main">
        <a href="/docs" onClick={linkClick('/docs')} aria-current={current('/docs')}>
          Docs
        </a>
        {/* A full page load, so the access-code check runs. */}
        <a href="/workshop" aria-current={current('/workshop')}>
          Workshop
        </a>
        <a href="/studio" aria-current={current('/studio')}>
          Studio <span className="soon-tag">New</span>
        </a>
      </nav>
      <ThemeToggle />
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>Prompt IQ · Private beta</span>
      <span>Your prompts stay in your browser. Estimates are guidance, not bills.</span>
      <span className="version">Version {__APP_VERSION__}</span>
    </footer>
  );
}
