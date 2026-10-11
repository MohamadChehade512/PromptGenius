import { Component, Suspense, lazy, type ReactNode } from 'react';
import { usePath } from '../lib/router';
import { DocsPage } from './DocsPage';
import { HomePage } from './HomePage';
import { SiteFooter, SiteHeader } from './SiteHeader';
import { NotFoundPage } from './SimplePages';

const WorkshopPage = lazy(() => import('./WorkshopPage'));
const StudioPage = lazy(() => import('./StudioPage'));

function Loading({ label }: { label: string }) {
  return (
    <div className="page-loading" role="status">
      Loading {label}…
    </div>
  );
}

/** If a tool's code can't load (offline, or the access check), offer a clean retry. */
class ToolBoundary extends Component<
  { children: ReactNode; label: string; href: string },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="page notice-page">
        <h1 className="display">{this.props.label} didn’t load.</h1>
        <p className="lede">Check your connection, then try again.</p>
        <a className="button primary" href={this.props.href}>
          Try again
        </a>
      </main>
    );
  }
}

function page(path: string) {
  switch (path) {
    case '/':
      return <HomePage />;
    case '/docs':
      return <DocsPage />;
    case '/workshop':
      return (
        <ToolBoundary label="The Workshop" href="/workshop">
          <Suspense fallback={<Loading label="Prompt Workshop" />}>
            <WorkshopPage />
          </Suspense>
        </ToolBoundary>
      );
    case '/studio':
      return (
        <ToolBoundary label="Studio" href="/studio">
          <Suspense fallback={<Loading label="Prompt Studio" />}>
            <StudioPage />
          </Suspense>
        </ToolBoundary>
      );
    default:
      return <NotFoundPage />;
  }
}

export function Root() {
  const path = usePath();
  return (
    <div className="site">
      <SiteHeader path={path} />
      {page(path)}
      <SiteFooter />
    </div>
  );
}
