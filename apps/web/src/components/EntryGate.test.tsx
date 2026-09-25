import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../App';
import { TERMS_VERSION } from '../lib/agreement';
import { installFakeApi } from '../test/fakeApi';
import { EntryGate } from './EntryGate';

function renderGate() {
  return render(
    <EntryGate minLoadingMs={0}>
      {(agreement, withdraw) => (
        <div>
          <p>Welcome, {agreement.name}</p>
          <button type="button" onClick={withdraw}>
            Withdraw
          </button>
        </div>
      )}
    </EntryGate>,
  );
}

function fill(name: string, email: string, agree: boolean) {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: name } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  if (agree) fireEvent.click(screen.getByLabelText(/I have read and agree/));
  fireEvent.click(screen.getByRole('button', { name: 'Agree and continue' }));
}

describe('Entry gate', () => {
  it('shows a loading screen, then the terms', async () => {
    renderGate();
    expect(screen.getByRole('status').textContent).toContain('Loading PromptGenius');
    expect(await screen.findByRole('heading', { name: 'Before you start' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Terms of use' })).toBeTruthy();
    expect(screen.queryByText(/Welcome,/)).toBeNull();
  });

  it('requires a name, a valid email and ticking agree', async () => {
    renderGate();
    await screen.findByRole('heading', { name: 'Before you start' });
    fill('', 'not-an-email', false);
    expect(screen.getByText('Enter your name.')).toBeTruthy();
    expect(screen.getByText(/Enter a valid email/)).toBeTruthy();
    expect(screen.getByText('Tick the box to agree to the terms.')).toBeTruthy();
    expect(screen.queryByText(/Welcome,/)).toBeNull();
  });

  it('opens the tool after agreeing, and remembers it in this browser', async () => {
    const { unmount } = renderGate();
    await screen.findByRole('heading', { name: 'Before you start' });
    fill('  Ada Lovelace ', 'ada@example.com', true);
    expect(screen.getByText('Welcome, Ada Lovelace')).toBeTruthy();
    const saved = JSON.parse(localStorage.getItem('pg.agreement')!) as Record<string, string>;
    expect(saved).toMatchObject({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      termsVersion: TERMS_VERSION,
    });

    unmount();
    renderGate();
    expect(await screen.findByText('Welcome, Ada Lovelace')).toBeTruthy();
  });

  it('asks again when the terms change', async () => {
    localStorage.setItem(
      'pg.agreement',
      JSON.stringify({ name: 'Ada', email: 'ada@example.com', termsVersion: '2000-01-01' }),
    );
    renderGate();
    expect(await screen.findByRole('heading', { name: 'Before you start' })).toBeTruthy();
  });

  it('withdrawing deletes the details and returns to the terms', async () => {
    renderGate();
    await screen.findByRole('heading', { name: 'Before you start' });
    fill('Ada', 'ada@example.com', true);
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }));
    expect(localStorage.getItem('pg.agreement')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Before you start' })).toBeTruthy();
  });
});

describe('Tutorial', () => {
  const agreement = {
    name: 'Ada',
    email: 'ada@example.com',
    termsVersion: TERMS_VERSION,
    agreedAt: '2026-09-24T00:00:00.000Z',
  };

  it('starts after agreeing and steps through each part with Next', () => {
    installFakeApi();
    render(<App agreement={agreement} />);
    const dialog = screen.getByRole('dialog', { name: 'Welcome to PromptGenius' });
    expect(dialog.textContent).toContain('Step 1 of');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('dialog', { name: 'Simple or Advanced' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('dialog', { name: 'Welcome to PromptGenius' })).toBeTruthy();
  });

  it('every step points at a part that exists on the page', () => {
    installFakeApi();
    const { container } = render(<App agreement={agreement} />);
    for (;;) {
      const next = screen.queryByRole('button', { name: 'Next' });
      if (!next) break;
      fireEvent.click(next);
      const title = screen.getByRole('dialog').getAttribute('aria-labelledby')!;
      expect(document.getElementById(title)).toBeTruthy();
    }
    for (const target of [
      'mode',
      'target',
      'prompt',
      'attachments',
      'conversation',
      'score',
      'usage',
      'rewrite',
    ]) {
      expect(container.querySelector(`[data-tour="${target}"]`)).toBeTruthy();
    }
    fireEvent.click(screen.getByRole('button', { name: 'Start using PromptGenius' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('can be skipped from the top, stays skipped, and can be replayed', () => {
    installFakeApi();
    const { unmount } = render(<App agreement={agreement} />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip tutorial' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    unmount();

    render(<App agreement={agreement} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show tutorial' }));
    expect(screen.getByRole('dialog', { name: 'Welcome to PromptGenius' })).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
