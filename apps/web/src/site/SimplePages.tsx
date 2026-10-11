import { linkClick, useDocumentTitle } from '../lib/router';

export function NotFoundPage() {
  useDocumentTitle('Page not found · Prompt IQ');
  return (
    <main className="page notice-page">
      <p className="eyebrow">404</p>
      <h1 className="display">This page doesn’t exist.</h1>
      <a className="button secondary" href="/" onClick={linkClick('/')}>
        Back to Prompt IQ
      </a>
    </main>
  );
}
