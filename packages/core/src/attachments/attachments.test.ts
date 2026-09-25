import { describe, expect, it } from 'vitest';
import { analyzePrompt, type AnalysisInput } from '../analyze';
import { findModel, getDefaultModel, getMedia, type ImageTokenSpec } from '../config';
import { projectSession } from '../cost/session';
import {
  attachmentTokens,
  findAttachmentReferences,
  imageTokens,
  summarizeAttachment,
  type AttachmentSource,
} from './attachments';

const CLAUDE_HIGH: ImageTokenSpec = {
  scheme: 'patch',
  patchPx: 28,
  multiplier: 1,
  maxLongEdge: 2576,
  maxPatches: 4784,
};
const CLAUDE_STANDARD: ImageTokenSpec = { ...CLAUDE_HIGH, maxLongEdge: 1568, maxPatches: 1568 };

describe('imageTokens', () => {
  // Worked examples from Anthropic's vision docs ("Resolution and token cost").
  it.each([
    [200, 200, 64, 64],
    [1000, 1000, 1296, 1296],
    [1920, 1080, 2691, 1560],
    [2000, 1500, 3888, 1564],
    [3840, 2160, 4784, 1560],
  ])('Claude %ix%i → %i (high-res) / ≈%i (standard)', (w, h, high, standard) => {
    expect(imageTokens(w, h, CLAUDE_HIGH).tokens).toBe(high);
    // Standard-tier examples in the docs are rounded; stay within 1%.
    const std = imageTokens(w, h, CLAUDE_STANDARD).tokens;
    expect(std).toBeLessThanOrEqual(1568);
    expect(Math.abs(std - standard) / standard).toBeLessThan(0.01);
  });

  it('bills OpenAI 32px patches × 1.2 and caps at 2,500 patches', () => {
    const spec = getMedia('openai', getDefaultModel('openai')).image;
    expect(imageTokens(1024, 1024, spec).tokens).toBe(Math.round(32 * 32 * 1.2));
    expect(imageTokens(8000, 6000, spec).tokens).toBeLessThanOrEqual(Math.round(2500 * 1.2));
  });

  it('bills Gemini a flat amount per image', () => {
    const spec = getMedia('gemini', getDefaultModel('gemini')).image;
    expect(imageTokens(4000, 3000, spec).tokens).toBe(1120);
    expect(imageTokens(100, 100, spec).tokens).toBe(1120);
  });
});

const pdf = (pages: number, text: string): AttachmentSource => ({
  id: 'p',
  name: 'Q3-board-report.pdf',
  kind: 'pdf',
  bytes: 100_000,
  pages,
  text,
});

describe('attachmentTokens', () => {
  it('prices a PDF as text + page images on Claude and flat per page on Gemini', () => {
    const a = summarizeAttachment(pdf(10, 'Revenue grew twelve percent. '.repeat(200)));
    const claude = getDefaultModel('claude');
    const c = attachmentTokens(a, claude, getMedia('claude', claude));
    expect(c.textTokens).toBeGreaterThan(0);
    expect(c.visualTokens).toBe(10 * imageTokens(816, 1056, CLAUDE_HIGH).tokens);

    const gemini = getDefaultModel('gemini');
    const g = attachmentTokens(a, gemini, getMedia('gemini', gemini));
    expect(g).toMatchObject({ textTokens: 0, visualTokens: 5600, tokens: 5600 });
  });

  it('uses the older model’s lower image resolution when it overrides the platform', () => {
    const haiku = findModel('claude', 'claude-haiku-4-5')!;
    const a = summarizeAttachment({
      id: 'i',
      name: 'photo.jpg',
      kind: 'image',
      bytes: 1,
      width: 3840,
      height: 2160,
    });
    expect(attachmentTokens(a, haiku, getMedia('claude', haiku)).tokens).toBeLessThanOrEqual(1568);
  });

  it('scales a truncated text file back up to its full size', () => {
    const text = 'word '.repeat(1000);
    const full = summarizeAttachment({ id: 't', name: 'a.txt', kind: 'text', bytes: 1, text });
    const half = summarizeAttachment({
      id: 't',
      name: 'a.txt',
      kind: 'text',
      bytes: 1,
      text: text.slice(0, text.length / 2),
      truncatedRatio: 2,
    });
    expect(Math.abs(half.baseTextTokens - full.baseTextTokens)).toBeLessThan(5);
  });
});

describe('findAttachmentReferences', () => {
  const files = [{ name: 'Q3_board-report.pdf' }, { name: 'forecast.xlsx' }];
  it.each([
    ['summarize the attached report', true, false],
    ['compare q3 board report with the forecast', true, true],
    ['what does page 3 of the pdf say?', true, true],
    ['compare both files', true, true],
    ['write an essay about dogs', false, false],
  ])('%s', (prompt, any, distinguishes) => {
    const r = findAttachmentReferences(prompt, files);
    expect(r.any).toBe(any);
    expect(r.distinguishes).toBe(distinguishes);
  });
});

const BRIEF: AttachmentSource = pdf(
  1,
  'HIST 110 essay assignment. Write an argumentative essay of 800 words on whether the printing press caused the Protestant Reformation, for first-year history students. Use evidence from Eisenstein and Pettegree and address one counterargument. Rubric: thesis 25%, evidence 35%, counterargument 20%, prose 20%.',
);

describe('analyzePrompt with attachments', () => {
  const base: AnalysisInput = {
    platform: 'claude',
    useCase: 'writing',
    mode: 'advanced',
    prompt: '',
  };
  const run = (
    prompt: string,
    files: AttachmentSource[] = [],
    extra: Partial<AnalysisInput> = {},
  ) => analyzePrompt({ ...base, prompt, attachments: files.map(summarizeAttachment), ...extra });

  it('adds file tokens to input, but not to the cached prefix', () => {
    const plain = run('Summarize the attached report.', [], { historyTokens: 10_000 });
    const withFile = run('Summarize the attached report.', [BRIEF], { historyTokens: 10_000 });
    expect(withFile.fileTokens).toBeGreaterThan(1000);
    expect(withFile.inputTokens - plain.inputTokens).toBe(withFile.fileTokens);
    expect(withFile.cost.cacheApplies).toBe(true);
    // The history is read from cache, but the new file is billed at the full input rate.
    expect(withFile.cost.midWithCache - plain.cost.midWithCache).toBeGreaterThan(0);
  });

  it('doesn’t credit a new file as cached on the first turn of a session', () => {
    const model = getDefaultModel('claude');
    const shared = {
      model,
      fixedTokens: 50_000,
      userTokensPerTurn: 100,
      assistantTokensPerTurn: 500,
      thinkingTokensPerTurn: 0,
      turns: 3,
      prefixCached: true,
    };
    const a = projectSession(shared);
    const b = projectSession({ ...shared, firstTurnNewTokens: 40_000 });
    expect(b.turns[0]!.costCached).toBeGreaterThan(a.turns[0]!.costCached);
    expect(b.turns[1]!.costCached).toBeCloseTo(a.turns[1]!.costCached, 10);
  });

  it('keeps a bare prompt weak when the file is never mentioned', () => {
    const bare = run('write an essay').score!;
    const unreferenced = run('write an essay', [BRIEF, pdf(3, 'Quarterly revenue ')]).score!;
    expect(unreferenced.total).toBeLessThan(50);
    expect(unreferenced.total - bare.total).toBeLessThan(10);
    expect(unreferenced.findings.map((f) => f.ruleId)).toContain('context.unreferenced-file');
  });

  it('raises the score when the prompt points at a relevant file', () => {
    const prompt = 'Write the essay described in the attached assignment brief.';
    const without = run(prompt).score!;
    const withBrief = run(prompt, [BRIEF]).score!;
    expect(withBrief.total).toBeGreaterThan(without.total + 15);
    const ids = withBrief.findings.map((f) => f.ruleId);
    expect(ids).not.toContain('clarity.missing-referent');
    expect(ids).not.toContain('context.no-details');
  });

  it('flags a file whose content doesn’t match the prompt’s topic', () => {
    const r = run('Using the attached file, explain the causes of the French Revolution.', [
      pdf(2, 'Quarterly revenue grew because enterprise renewals rose. '.repeat(40)),
    ]).score!;
    expect(r.findings.map((f) => f.ruleId)).toContain('context.file-mismatch');
  });

  it('asks which file is which when several are attached', () => {
    const r = run('Summarize the attached documents.', [
      BRIEF,
      { ...BRIEF, id: 'b', name: 'b.pdf' },
    ]);
    expect(r.score!.findings.map((f) => f.ruleId)).toContain('structure.which-file');
  });
});

describe('reviewing your own material (user report, 2026-09-24)', () => {
  const RESUME: AttachmentSource = {
    id: 'resume',
    name: 'Jordan_Rivera_Resume.pdf',
    kind: 'pdf',
    bytes: 90_000,
    pages: 1,
    text: 'Jordan Rivera. Financial Analyst Intern, Maple Bank: built Excel models to forecast quarterly loan volumes and cut reporting time by 30%. Skills: Excel, SQL, Power BI, Python. Bachelor of Commerce, Finance, University of Toronto. Sales Associate, Best Buy: trained four new hires.',
  };
  const PHOTO: AttachmentSource = {
    id: 'photo',
    name: 'IMG_4821.jpg',
    kind: 'image',
    bytes: 2_000_000,
    width: 4032,
    height: 3024,
  };
  const score = (prompt: string, files: AttachmentSource[]) =>
    analyzePrompt({
      platform: 'claude',
      useCase: 'qa',
      mode: 'simple',
      prompt,
      attachments: files.map(summarizeAttachment),
    }).score!;
  const ids = (s: ReturnType<typeof score>) => s.findings.map((f) => f.ruleId);
  const vague = 'Review my resume and tell me what to improve.';

  it('scores a goal-less, yardstick-less review as weak even with the file', () => {
    const s = score(vague, [RESUME]);
    expect(s.total).toBeLessThan(50);
    expect(ids(s)).toEqual(
      expect.arrayContaining(['context.no-purpose', 'output.no-review-focus']),
    );
  });

  it('drops sharply when the resume is removed', () => {
    const withFile = score(vague, [RESUME]).total;
    const without = score(vague, []);
    expect(withFile - without.total).toBeGreaterThan(20);
    expect(ids(without)).toEqual(
      expect.arrayContaining(['clarity.missing-referent', 'context.missing-material']),
    );
  });

  it('flags a prompt that stops mid-sentence', () => {
    expect(ids(score('review my resume and', [RESUME]))).toContain('clarity.unfinished');
  });

  it('rewards a specific review: goal, audience, bounded output', () => {
    const s = score(
      'Review the attached resume for an entry-level financial analyst role at a Canadian bank. List the 5 highest-impact changes as bullet points, each with a rewritten example line, and flag any keywords an applicant tracking system might miss.',
      [RESUME],
    );
    expect(s.total).toBeGreaterThanOrEqual(85);
  });

  it('doesn’t let an unrelated image stand in for the document', () => {
    const photoOnly = score(vague, [PHOTO]);
    expect(photoOnly.total).toBeLessThan(50);
    expect(ids(photoOnly)).toContain('context.document-as-image');
    // An image the prompt points at is still fine.
    const pointed = score('What does the error in this screenshot mean?', [
      { ...PHOTO, name: 'error.png', width: 1280, height: 720 },
    ]);
    expect(ids(pointed)).not.toContain('context.document-as-image');
  });

  it('only a brief, spec or job description softens the purpose check', () => {
    const material = score('Rewrite the attached essay.', [
      { ...RESUME, name: 'essay.pdf', text: RESUME.text },
    ]);
    const softened = (s: ReturnType<typeof score>) =>
      s.findings.find((f) => f.ruleId === 'context.no-purpose')?.message.includes('Softened');
    expect(softened(material)).toBeFalsy();
  });
});
