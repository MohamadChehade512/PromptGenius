import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installFakeApi } from '../test/fakeApi';
import { Studio } from './Studio';

/** A stand-in for the browser's SpeechRecognition: tests "speak" by calling `say`. */
class FakeRecognition {
  static current: FakeRecognition | null = null;
  continuous = false;
  interimResults = false;
  lang = '';
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  started = false;
  start() {
    this.started = true;
    FakeRecognition.current = this;
  }
  stop() {
    this.started = false;
    this.onend?.();
  }
  abort() {
    this.started = false;
  }
  say(text: string, isFinal = true) {
    this.onresult?.({ resultIndex: 0, results: [{ isFinal, 0: { transcript: text } }] });
  }
}

function withSpeech() {
  vi.stubGlobal('webkitSpeechRecognition', FakeRecognition);
}
const say = (text: string, isFinal = true) =>
  act(() => FakeRecognition.current!.say(text, isFinal));
const prompt = () => document.querySelector('.studio-prompt')?.textContent ?? '';

afterEach(() => {
  FakeRecognition.current = null;
});

describe('Prompt Studio', () => {
  it('turns speech into a refined prompt, fixing a spoken slip', () => {
    withSpeech();
    render(<Studio />);
    fireEvent.click(screen.getByRole('button', { name: 'Start speaking' }));
    expect(screen.getByRole('status').textContent).toMatch(/Listening/);
    say('draft an email to Roger um I mean Michael');
    expect(prompt()).toBe('Draft an email to Michael.');
    // What was said stays visible, with the dropped words struck through.
    const said = screen.getByLabelText('What I heard');
    expect(said.textContent?.trim()).toBe('draft an email to Roger um I mean Michael');
    expect([...said.querySelectorAll('.said-cut')].map((w) => w.textContent?.trim())).toEqual([
      'Roger',
      'um',
      'I',
      'mean',
    ]);
    // …and the change is named.
    expect(screen.getByRole('list', { name: 'What changed' }).textContent).toContain(
      'Roger → Michael',
    );
    // Edit opens the text for fixing a misheard word.
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText<HTMLTextAreaElement>('What I heard').value).toBe(
      'draft an email to Roger um I mean Michael',
    );
  });

  it('coaches on what to add, and folds spoken context into the prompt', () => {
    withSpeech();
    render(<Studio />);
    fireEvent.click(screen.getByRole('button', { name: 'Start speaking' }));
    say('draft an email to Michael about moving the budget meeting to Thursday');
    expect(screen.getByText('Add a purpose')).toBeTruthy();
    expect(screen.getByText('Add a tone or audience')).toBeTruthy();

    say('the tone should be friendly');
    expect(prompt()).toContain('Tone: Friendly');
    expect(screen.queryByText('Add a tone or audience')).toBeNull();
    expect(screen.getByRole('list', { name: 'What changed' }).textContent).toContain(
      'Tone → its own line',
    );

    say('the purpose is to get his approval by Friday');
    expect(prompt()).toContain('Purpose: To get his approval by Friday');
    expect(screen.queryByText('Add a purpose')).toBeNull();
  });

  it('shows what was saved: the request alone against the finished prompt', () => {
    withSpeech();
    render(<Studio />);
    fireEvent.click(screen.getByRole('button', { name: 'Start speaking' }));
    say('hey could you please write something about our new app for social media thanks so much');
    // Nothing added yet: the comparison is spoken vs refined.
    expect(screen.getByRole('columnheader', { name: 'As spoken' })).toBeTruthy();
    expect(screen.getByText(/fewer than as spoken/)).toBeTruthy();

    say('the tone should be friendly and keep it under 80 words');
    const table = screen.getByRole('table');
    expect(screen.getByRole('columnheader', { name: 'Request alone' })).toBeTruthy();
    expect(table.textContent).toMatch(/Saves about [\d,]+ tokens per answer/);
    expect([...table.querySelectorAll('tbody th')].map((h) => h.textContent)).toEqual([
      'Quality',
      'Per answer',
    ]);
    // Quality went up and the tokens per answer went down, and both say so.
    const good = [...table.querySelectorAll('.impact-good')].map((d) => d.textContent ?? '');
    expect(good.some((d) => d.startsWith('+'))).toBe(true);
    expect(good.some((d) => d.startsWith('−') && d.endsWith('%'))).toBe(true);
  });

  it('shows words still being spoken without adding them yet', () => {
    withSpeech();
    render(<Studio />);
    fireEvent.click(screen.getByRole('button', { name: 'Start speaking' }));
    say('write a', false);
    expect(document.querySelector('.interim')!.textContent).toBe('write a');
    expect(prompt()).toBe('');
  });

  it('stops listening and copies the prompt', async () => {
    withSpeech();
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { ...navigator, language: 'en-US', clipboard: { writeText } });
    render(<Studio />);
    fireEvent.click(screen.getByRole('button', { name: 'Start speaking' }));
    say('summarize this article in five bullet points');
    fireEvent.click(screen.getByRole('button', { name: 'Stop the microphone' }));
    expect(screen.getByText('Tap to keep talking')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith('Summarize this article in five bullet points.');
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeTruthy();
  });

  it('explains a blocked microphone', () => {
    withSpeech();
    render(<Studio />);
    fireEvent.click(screen.getByRole('button', { name: 'Start speaking' }));
    act(() => FakeRecognition.current!.onerror?.({ error: 'not-allowed' }));
    expect(screen.getByRole('alert').textContent).toMatch(/Microphone access is blocked/);
  });

  it('still works by typing where speech isn’t supported', () => {
    render(<Studio />);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Start speaking' }).disabled).toBe(
      true,
    );
    fireEvent.change(screen.getByLabelText('What I heard'), {
      target: { value: 'could you please write a haiku about autumn' },
    });
    expect(prompt()).toBe('Write a haiku about autumn.');
    expect(screen.getByText(/^(?:Weak|Needs work|Good|Excellent)$/)).toBeTruthy();
    // The use case is worked out from what was said.
    expect(screen.getByRole('option', { name: 'Auto (Writing)' })).toBeTruthy();
  });
});

describe('Prompt Studio: refine with Claude (paid)', () => {
  const claude = (transcript: string) =>
    transcript.includes('whoever runs finance')
      ? {
          prompt: 'Write an email to Michael about moving the budget meeting.\nTone: Professional',
          question: 'Which day should it move to?',
          changes: ['Roger → Michael', 'Tone from “not too casual”'],
        }
      : { prompt: 'Draft an email to Michael.', question: '', changes: [] };

  it('is off by default and never calls Claude until switched on', async () => {
    withSpeech();
    const api = installFakeApi({ studioRefine: claude });
    render(<Studio refineDelayMs={0} />);
    const toggle = await screen.findByRole<HTMLInputElement>('switch', {
      name: /Refine with Claude/,
    });
    await waitFor(() => expect(toggle.disabled).toBe(false));
    expect(toggle.checked).toBe(false);
    expect(screen.getByText(/About \$0\.0009 per update/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Start speaking' }));
    say('draft an email to Roger um I mean Michael');
    await act(() => new Promise((r) => setTimeout(r, 30)));
    expect(api.calls('/api/studio/refine')).toHaveLength(0);
    expect(prompt()).toBe('Draft an email to Michael.');
  });

  it('uses Claude’s version, shows its question and the running cost once switched on', async () => {
    withSpeech();
    const api = installFakeApi({ studioRefine: claude });
    render(<Studio refineDelayMs={0} />);
    const toggle = await screen.findByRole<HTMLInputElement>('switch', {
      name: /Refine with Claude/,
    });
    await waitFor(() => expect(toggle.disabled).toBe(false));
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole('button', { name: 'Start speaking' }));
    say('email Roger actually he left so whoever runs finance now I think Michael not too casual');
    await waitFor(() => expect(prompt()).toContain('Tone: Professional'));
    expect(screen.getByText('Which day should it move to?')).toBeTruthy();
    expect(screen.getByRole('list', { name: 'What changed' }).textContent).toContain(
      'Tone from “not too casual”',
    );
    expect(screen.getByText('Refined by Claude')).toBeTruthy();
    expect(screen.getByText(/Spent this session: \$0\.0008/)).toBeTruthy();
    // The same speech is never sent twice.
    expect(api.calls('/api/studio/refine')).toHaveLength(1);
    const sent = JSON.parse(api.calls('/api/studio/refine')[0]![1]!.body as string) as {
      transcript: string;
      gaps: string[];
    };
    expect(sent.transcript).toContain('whoever runs finance');
    expect(sent.gaps.length).toBeGreaterThan(0);
  });

  it('falls back to the built-in version when Claude fails', async () => {
    withSpeech();
    installFakeApi({ studioRefine: () => ({ error: 'upstream_error', status: 502 }) });
    render(<Studio refineDelayMs={0} />);
    const toggle = await screen.findByRole<HTMLInputElement>('switch', {
      name: /Refine with Claude/,
    });
    await waitFor(() => expect(toggle.disabled).toBe(false));
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole('button', { name: 'Start speaking' }));
    say('draft an email to Roger um I mean Michael');
    expect((await screen.findByRole('alert')).textContent).toMatch(/Refine failed/);
    expect(prompt()).toBe('Draft an email to Michael.');
  });

  it('says so, and stays free, where Claude isn’t available', async () => {
    installFakeApi();
    render(<Studio />);
    expect(await screen.findByRole('button', { name: 'Add your Anthropic API key' })).toBeTruthy();
    expect(
      screen.getByRole<HTMLInputElement>('switch', { name: /Refine with Claude/ }).disabled,
    ).toBe(true);
  });
});
