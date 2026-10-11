import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '../lib/apiError';
import { forgetApiKey, readApiKey } from '../lib/apiKey';
import { ApiKeyControl } from './ApiKeyControl';

const verifyKey = vi.hoisted(() => vi.fn<(key: string) => Promise<void>>());
vi.mock('../lib/direct', () => ({ verifyKey }));

const KEY = 'sk-ant-api03-' + 'a1B2c3D4'.repeat(4) + 'wxYZ';
const STORED = 'pg.anthropicKey';

function enter(value: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Add your Anthropic API key' }));
  fireEvent.change(screen.getByLabelText('API key'), { target: { value } });
}
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Check and save' }));

describe('Your own API key', () => {
  beforeEach(() => {
    forgetApiKey();
    verifyKey.mockReset();
    verifyKey.mockResolvedValue();
  });

  it('keeps a checked key for this tab only by default, and never shows it in full', async () => {
    render(<ApiKeyControl feature="the AI rewrite" />);
    enter(`  ${KEY}  `);
    expect(screen.getByLabelText<HTMLInputElement>('API key').type).toBe('password');
    submit();

    expect(await screen.findByText(/kept for this tab only/)).toBeTruthy();
    expect(verifyKey).toHaveBeenCalledWith(KEY);
    expect(sessionStorage.getItem(STORED)).toBe(KEY);
    expect(localStorage.getItem(STORED)).toBeNull();
    expect(document.body.textContent).toContain('…wxYZ');
    expect(document.body.innerHTML).not.toContain(KEY);
  });

  it('remembers it on the device only when asked, and forgets it everywhere', async () => {
    render(<ApiKeyControl feature="the AI rewrite" />);
    enter(KEY);
    fireEvent.click(screen.getByRole('radio', { name: /On this device/ }));
    submit();

    expect(await screen.findByText(/remembered on this device/)).toBeTruthy();
    expect(localStorage.getItem(STORED)).toBe(KEY);
    expect(sessionStorage.getItem(STORED)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Forget key' }));
    expect(readApiKey()).toBeNull();
    expect(localStorage.getItem(STORED)).toBeNull();
    expect(screen.getByRole('button', { name: 'Add your Anthropic API key' })).toBeTruthy();
  });

  it('rejects text that isn’t a key, and admin keys, without contacting Anthropic', () => {
    render(<ApiKeyControl feature="the AI rewrite" />);
    enter('hunter2');
    submit();
    expect(screen.getByRole('alert').textContent).toMatch(/doesn’t look like/);

    fireEvent.change(screen.getByLabelText('API key'), {
      target: { value: 'sk-ant-admin01-' + 'x'.repeat(40) },
    });
    submit();
    expect(screen.getByRole('alert').textContent).toMatch(/admin key/);
    expect(verifyKey).not.toHaveBeenCalled();
    expect(readApiKey()).toBeNull();
  });

  it('saves nothing when Anthropic rejects the key', async () => {
    verifyKey.mockRejectedValue(
      new ApiRequestError(401, 'upstream_auth', 'Anthropic didn’t accept that key.'),
    );
    render(<ApiKeyControl feature="the AI rewrite" />);
    enter(KEY);
    submit();
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/didn’t accept/));
    expect(readApiKey()).toBeNull();
    expect(sessionStorage.getItem(STORED)).toBeNull();
  });

  it('ignores anything in storage that isn’t a key', () => {
    sessionStorage.setItem(STORED, '<img src=x onerror=alert(1)>');
    expect(readApiKey()).toBeNull();
  });
});
