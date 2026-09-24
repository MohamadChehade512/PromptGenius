import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('renders the heading and reports the API online', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(Response.json({ status: 'ok', version: '0.0.0' }))),
    );
    render(<App />);
    expect(screen.getByRole('heading', { name: 'PromptGenius' })).toBeTruthy();
    expect(await screen.findByText('API: online')).toBeTruthy();
  });

  it('reports the API offline when the health check fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('down'))),
    );
    render(<App />);
    expect(await screen.findByText('API: offline')).toBeTruthy();
  });
});
