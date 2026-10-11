import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { installFakeApi } from './test/fakeApi';

const WEAK = 'write something nice about dogs';

function type(text: string) {
  fireEvent.change(screen.getByLabelText('Your prompt'), { target: { value: text } });
}

describe('App (Simple mode)', () => {
  it('copies the prompt to the clipboard', async () => {
    installFakeApi();
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    render(<App />);
    const copy = screen.getByRole<HTMLButtonElement>('button', { name: 'Copy' });
    expect(copy.disabled).toBe(true);
    type(WEAK);
    fireEvent.click(copy);
    expect(writeText).toHaveBeenCalledWith(WEAK);
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeTruthy();
  });

  it('shows score, tokens and relative usage as you type', async () => {
    installFakeApi();
    render(<App />);
    expect(await screen.findByText('API: online')).toBeTruthy();
    type(WEAK);
    expect(await screen.findByRole('img', { name: /Prompt score \d+ out of 100/ })).toBeTruthy();
    expect(screen.getByText('Top suggestions')).toBeTruthy();
    expect(screen.getAllByText(/typical messages/).length).toBeGreaterThan(0);
    expect(screen.getByText('Cost of a retry')).toBeTruthy();
    expect(screen.queryByText('Cost per call')).toBeNull();
  });

  it('tints the page by score tone, and stays neutral when empty', async () => {
    installFakeApi();
    const { container } = render(<App />);
    const shell = container.querySelector('.shell')!;
    expect(shell.hasAttribute('data-tone')).toBe(false);
    type('write an essay');
    await screen.findByRole('img', { name: /Prompt score/ });
    expect(shell.getAttribute('data-tone')).toBe('bad');
    type('');
    expect(await screen.findByText('Start typing to see a score and suggestions.')).toBeTruthy();
    expect(shell.hasAttribute('data-tone')).toBe(false);
  });

  it('shows at most 3 suggestions in Simple mode', async () => {
    installFakeApi();
    render(<App />);
    type(WEAK);
    const list = (await screen.findByText('Top suggestions')).nextElementSibling as HTMLElement;
    expect(within(list).getAllByRole('listitem').length).toBeLessThanOrEqual(3);
  });

  it('uses the exact vendor count when the server has a key', async () => {
    installFakeApi({ features: { countClaude: true }, countTokens: 1234 });
    render(<App />);
    await screen.findByText('API: online');
    type(WEAK);
    expect(await screen.findByText('1,234', undefined, { timeout: 3000 })).toBeTruthy();
    expect(screen.getByText('exact')).toBeTruthy();
  });
});

describe('App (Advanced mode)', () => {
  it('shows dollars, model/effort controls, dimensions and the session chart', async () => {
    installFakeApi();
    render(<App />);
    fireEvent.click(screen.getByRole('radio', { name: 'Advanced' }));
    type(WEAK);
    expect(screen.getByText('Cost per call')).toBeTruthy();
    expect(screen.getByLabelText('Model')).toBeTruthy();
    expect(screen.getByLabelText('Reasoning effort')).toBeTruthy();
    expect(screen.getByText('Token economy')).toBeTruthy();
    expect(await screen.findByText(/Cost over the next 10 turns/)).toBeTruthy();
    expect(screen.getByText('Show as table')).toBeTruthy();
  });

  it('remembers the mode across reloads', () => {
    installFakeApi();
    const { unmount } = render(<App />);
    fireEvent.click(screen.getByRole('radio', { name: 'Advanced' }));
    unmount();
    render(<App />);
    expect(screen.getByRole('radio', { name: 'Advanced' }).getAttribute('aria-checked')).toBe(
      'true',
    );
  });
});

describe('Paid AI rewrite', () => {
  const result = {
    type: 'result' as const,
    result: {
      rewritten_prompt: 'Write a 100-word, warm ode to dogs for a pet-shop newsletter.',
      changes: [{ change: 'Added length', reason: 'Bounds output.' }],
    },
    usage: { inputTokens: 900, outputTokens: 300, cacheReadTokens: 0, cacheWriteTokens: 0 },
    costUsd: 0.012,
    model: 'claude-opus-5',
  };

  it('labels the button as paid with a price, and is disabled without a key', async () => {
    installFakeApi({ rewriteEnabled: false });
    render(<App />);
    type(WEAK);
    const button = await screen.findByRole('button', { name: /Rewrite with AI · Paid · ≈ \$/ });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(await screen.findByText(/Add your Anthropic API key to turn on/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add your Anthropic API key' })).toBeTruthy();
  });

  it('never calls the paid endpoint without an explicit, confirmed click', async () => {
    const api = installFakeApi({
      rewriteEnabled: true,
      rewriteEvents: [{ type: 'started', reservedUsd: 0.2 }, result],
    });
    render(<App />);
    type(WEAK);
    const button = await screen.findByRole('button', { name: /Rewrite with AI · Paid/ });
    await screen.findByText(/Daily budget/);
    expect(api.calls('/api/rewrite')).toHaveLength(0);

    fireEvent.click(button);
    expect(screen.getByRole('dialog', { name: 'Use a paid AI rewrite?' })).toBeTruthy();
    expect(api.calls('/api/rewrite')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: /^Rewrite · ≈/ }));
    expect(await screen.findByText(/This rewrite cost/)).toBeTruthy();
    expect(screen.getByText('$0.012')).toBeTruthy();
    expect(api.calls('/api/rewrite')).toHaveLength(1);

    // Confirmed once per session: the second click goes straight through.
    fireEvent.click(screen.getByRole('button', { name: /Rewrite with AI · Paid/ }));
    await screen.findAllByText(/This rewrite cost/);
    expect(api.calls('/api/rewrite')).toHaveLength(2);
  });

  it('can replace the editor text with the rewrite', async () => {
    installFakeApi({ rewriteEnabled: true, rewriteEvents: [result] });
    sessionStorage.setItem('pg.rewrite.confirmed', 'true');
    render(<App />);
    type(WEAK);
    await screen.findByText(/Daily budget/);
    fireEvent.click(screen.getByRole('button', { name: /Rewrite with AI · Paid/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Use this prompt' }));
    expect(screen.getByLabelText<HTMLTextAreaElement>('Your prompt').value).toBe(
      result.result.rewritten_prompt,
    );

    // The result gives way to a one-line confirmation, and Undo brings the original back.
    expect(screen.queryByRole('button', { name: 'Use this prompt' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByLabelText<HTMLTextAreaElement>('Your prompt').value).toBe(WEAK);
  });

  it('shows errors and any partial charge', async () => {
    installFakeApi({
      rewriteEnabled: true,
      rewriteEvents: [
        { type: 'error', error: 'truncated', message: 'The rewrite was cut off.', costUsd: 0.004 },
      ],
    });
    sessionStorage.setItem('pg.rewrite.confirmed', 'true');
    render(<App />);
    type(WEAK);
    await screen.findByText(/Daily budget/);
    fireEvent.click(screen.getByRole('button', { name: /Rewrite with AI · Paid/ }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('$0.0040');
  });
});

describe('Conversation so far', () => {
  it('adds earlier messages to usage and warns on long chats', async () => {
    installFakeApi();
    render(<App />);
    type('Summarize the key decisions from our discussion in 5 bullet points for the team.');
    const before = screen.getAllByText(/typical messages/)[0]!.parentElement!.textContent;
    fireEvent.change(screen.getByLabelText('Conversation so far'), { target: { value: 'long' } });
    expect(await screen.findByText('Earlier conversation (resent)')).toBeTruthy();
    expect(screen.getAllByText(/typical messages/)[0]!.parentElement!.textContent).not.toBe(before);
    expect(screen.getByText('Long conversation.')).toBeTruthy();
  });

  it('accepts a custom token amount', () => {
    installFakeApi();
    render(<App />);
    type('make it shorter');
    fireEvent.change(screen.getByLabelText('Conversation so far'), { target: { value: 'custom' } });
    fireEvent.change(screen.getByLabelText('Tokens already in the chat'), {
      target: { value: '12345' },
    });
    expect(screen.getByText('12,345')).toBeTruthy();
  });
});

describe('Suggestions cite multiple publishers', () => {
  it('links sources beyond Anthropic', async () => {
    installFakeApi();
    render(<App />);
    type('write an essay');
    await screen.findByText('Top suggestions');
    const links = screen.getAllByRole('link').map((a) => a.textContent);
    expect(links).toEqual(expect.arrayContaining(['OpenAI', 'Google']));
  });
});

describe('Attached files', () => {
  const BRIEF = [
    'HIST 110 essay assignment.',
    'Write an argumentative essay of 800 words on whether the printing press caused the Protestant Reformation, for first-year history students.',
    'Use evidence from Eisenstein and Pettegree and address one counterargument.',
    'Rubric: thesis 25%, evidence 35%, counterargument 20%, prose 20%.',
  ].join('\n');

  function attach(...files: File[]) {
    fireEvent.change(screen.getByLabelText('Attach files'), { target: { files } });
  }
  const score = () =>
    Number(
      /Prompt score (\d+)/.exec(
        screen.getByRole('img', { name: /Prompt score/ }).getAttribute('aria-label')!,
      )![1],
    );

  it('reads a text file in the browser, counts its tokens and raises a referencing prompt', async () => {
    installFakeApi();
    render(<App />);
    type('Write the essay described in the attached assignment brief.');
    const before = score();
    attach(new File([BRIEF], 'essay-brief.md', { type: 'text/markdown' }));
    const list = await screen.findByRole('list', { name: 'Attached files' });
    expect(await within(list).findByText(/tokens/)).toBeTruthy();
    expect(screen.getByText('Attached file (1)')).toBeTruthy();
    await waitFor(() => expect(score()).toBeGreaterThan(before + 10));
  });

  it('flags an attached file the prompt never mentions', async () => {
    installFakeApi();
    render(<App />);
    type('write an essay');
    attach(new File([BRIEF], 'essay-brief.md', { type: 'text/markdown' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Advanced' }));
    expect(await screen.findByText("Attached file isn't mentioned.")).toBeTruthy();
  });

  it('rejects unsupported and binary files, and removes files', async () => {
    installFakeApi();
    render(<App />);
    attach(
      new File(['MZ'], 'setup.exe', { type: 'application/octet-stream' }),
      new File(['a\u0000b'], 'data.txt', { type: 'text/plain' }),
    );
    expect(await screen.findByText(/Unsupported file type/)).toBeTruthy();
    expect(await screen.findByText("This doesn't look like a text file.")).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove setup.exe' }));
    expect(screen.queryByText(/Unsupported file type/)).toBeNull();
  });
});

describe('Removing a file updates the score', () => {
  it('drops the score when the resume a review depends on is removed', async () => {
    installFakeApi();
    render(<App />);
    type('Review my resume for a junior data analyst role and list the 5 biggest fixes.');
    const resume = new File(
      [
        'Jordan Rivera. Financial Analyst Intern, Maple Bank: built Excel models to forecast quarterly loan volumes and cut reporting time by 30%. Skills: Excel, SQL, Power BI, Python, financial modeling. Bachelor of Commerce, Finance, University of Toronto.',
      ],
      'resume.txt',
      { type: 'text/plain' },
    );
    fireEvent.change(screen.getByLabelText('Attach files'), { target: { files: [resume] } });
    await screen.findByText('Attached file (1)');
    const aria = () =>
      screen.getByRole('img', { name: /Prompt score/ }).getAttribute('aria-label')!;
    const withFile = Number(/(\d+) out of/.exec(aria())![1]);
    fireEvent.click(screen.getByRole('button', { name: 'Remove resume.txt' }));
    await waitFor(() =>
      expect(Number(/(\d+) out of/.exec(aria())![1])).toBeLessThan(withFile - 15),
    );
  });
});

describe('Project access toggle', () => {
  it('drops the "paste your code" checks and is remembered', async () => {
    installFakeApi();
    const { unmount } = render(<App />);
    fireEvent.click(screen.getByRole('radio', { name: 'Advanced' }));
    type('Refactor src/utils/date.ts to use date-fns instead of moment. Make sure the tests pass.');
    fireEvent.change(screen.getByLabelText('Use case'), { target: { value: 'coding' } });
    expect(await screen.findByText('No language or stack.')).toBeTruthy();
    fireEvent.click(
      screen.getByRole('switch', { name: 'The AI can already see my project files' }),
    );
    await waitFor(() => expect(screen.queryByText('No language or stack.')).toBeNull());
    expect(screen.getByText(/also read your files as they work/)).toBeTruthy();
    unmount();
    render(<App />);
    expect(
      screen.getByRole<HTMLInputElement>('switch', {
        name: 'The AI can already see my project files',
      }).checked,
    ).toBe(true);
  });
});
