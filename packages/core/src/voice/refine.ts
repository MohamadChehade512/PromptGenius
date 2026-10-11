import type { UseCase } from '../types';

/**
 * Turns dictated speech into a prompt, with rules only (no AI call): fixes spoken slips
 * ("to Roger, um, I mean Michael"), drops fillers and politeness padding, and lifts spoken
 * context ("the tone should be friendly") into labeled lines. Deterministic and runs in the
 * browser; a model-based rewrite can replace `refineSpeech` later without changing callers.
 */

export const SLOT_KINDS = ['purpose', 'context', 'audience', 'tone', 'format', 'length'] as const;
export type SlotKind = (typeof SLOT_KINDS)[number];

export const SLOT_LABELS: Record<SlotKind, string> = {
  purpose: 'Purpose',
  context: 'Context',
  audience: 'Audience',
  tone: 'Tone',
  format: 'Format',
  length: 'Length',
};

/** One thing the refiner did, so the interface can show its work. */
export type SpeechChange =
  /** A spoken slip was fixed: "Roger" became "Michael". */
  | { kind: 'correction'; from: string; to: string }
  /** "Scratch that": something said was thrown away. */
  | { kind: 'retraction' }
  /** Fillers and stutters removed ("um", "you know", "the the"). */
  | { kind: 'fillers'; count: number }
  /** Politeness padding dropped ("could you please…", "thanks so much"). */
  | { kind: 'politeness' }
  /** Spoken context lifted into a labeled line. */
  | { kind: 'context'; slot: SlotKind };

export interface SpokenPrompt {
  /** The speech with slips and fillers removed, before it's restructured. */
  cleaned: string;
  /** The assembled prompt: the task, then one labeled line per piece of context. */
  prompt: string;
  /** The task on its own (first line of `prompt`). */
  task: string;
  /** Context lifted out of the speech. */
  slots: Partial<Record<SlotKind, string>>;
  /** What was changed on the way from speech to prompt, in the order it happened. */
  changes: SpeechChange[];
}

const SENTENCE_END = /[.!?]/;

/** "Scratch that": throw away what was just said, back to the start of the sentence. */
const RETRACT_RE =
  /[,\s]*\b(?:scratch that|delete that|forget that|never ?mind that|strike that|ignore that)\b[,.!\s]*/i;

/**
 * Strong correction markers only. Bare "no", "actually", "wait" and "sorry" are too common in
 * real instructions ("no hype", "what actually happened") to treat as corrections.
 */
const CORRECTION_RE =
  /[,.…\s]*(?:\b(?:um+|uh+|erm*|ah+)\b[,.…\s]+)?\b(?:(?:no|sorry|oops|wait)[,\s]+)?(?:i mean|i meant|no wait|wait no|or rather|make that|actually no|no actually)\b[,:\s]+/i;

const ARTICLES = new Set(['a', 'an', 'the']);
const POSSESSIVES = new Set(['my', 'our', 'your', 'his', 'her', 'their', 'its']);
const PREPOSITIONS = new Set([
  'to',
  'for',
  'on',
  'in',
  'at',
  'with',
  'from',
  'about',
  'by',
  'under',
  'over',
  'before',
  'after',
]);

const bare = (w: string) => w.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
const isProper = (w: string) => /^\p{Lu}/u.test(w.replace(/^[^\p{L}]+/u, ''));

function sameClass(a: string, b: string): boolean {
  if (a === b) return true;
  return (
    (ARTICLES.has(a) && ARTICLES.has(b)) ||
    (POSSESSIVES.has(a) && POSSESSIVES.has(b)) ||
    (PREPOSITIONS.has(a) && PREPOSITIONS.has(b))
  );
}

/**
 * Where the corrected part starts, as a word index into `words` (the words said before the
 * correction, within the current sentence).
 *
 *   "to my boss | I mean | my manager"   → the earlier "my"   (same word)
 *   "an email   | I mean | a letter"     → the earlier "an"   (same kind of word)
 *   "to Roger   | I mean | Michael"      → "Roger"            (a name replaces a name)
 *   "make it formal | no wait | casual"  → "formal"           (the last word)
 */
function correctionStart(words: string[], head: string): number {
  if (words.length === 0) return 0;
  const h = bare(head);
  const from = Math.max(0, words.length - 6);
  const functional = ARTICLES.has(h) || POSSESSIVES.has(h) || PREPOSITIONS.has(h);
  for (let i = words.length - 1; i >= from; i--) {
    const w = bare(words[i]!);
    if (functional ? sameClass(w, h) : w === h) return i;
  }
  let i = words.length - 1;
  if (isProper(head)) {
    // A run of capitalized words ("Roger Smith"), but never the sentence's first word alone.
    while (i > 0 && isProper(words[i]!) && isProper(words[i - 1]!) && i - 1 > 0) i--;
  }
  return i;
}

function startsWithCue(text: string): boolean {
  return CUES.some((cue) => {
    cue.re.lastIndex = 0;
    const m = cue.re.exec(text);
    return m?.index === 0;
  });
}

function applyCorrections(input: string, changes: SpeechChange[]): string {
  let text = input;
  for (let guard = 0; guard < 20; guard++) {
    const m = CORRECTION_RE.exec(text);
    if (!m) break;
    const before = text.slice(0, m.index);
    const after = text.slice(m.index + m[0].length);
    const head = after.split(/\s+/)[0] ?? '';
    if (!head) {
      text = before;
      break;
    }
    // "Actually no, the tone should be casual": restating a piece of context replaces that
    // context (the latest one wins), not the words before it.
    if (startsWithCue(after)) {
      text = `${before.replace(/[,\s]+$/, '')}. ${after}`;
      continue;
    }
    // Only the current sentence can be corrected.
    let sentenceStart = 0;
    for (let i = before.length - 1; i >= 0; i--) {
      if (SENTENCE_END.test(before[i]!) && /\s/.test(before[i + 1] ?? ' ')) {
        sentenceStart = i + 1;
        break;
      }
    }
    const lead = before.slice(0, sentenceStart);
    const words = before.slice(sentenceStart).trim().split(/\s+/).filter(Boolean);
    const start = correctionStart(words, head);
    const keep = words.slice(0, start);
    const dropped = words
      .slice(start)
      .join(' ')
      .replace(/[,.;:]+$/, '');
    // Show the slip as the words that changed: "to Roger" → "to Michael" reads as Roger → Michael.
    const droppedWords = dropped.split(/\s+/);
    const from = droppedWords[droppedWords.length - 1] ?? dropped;
    const replacement = after.split(/\s+/).slice(0, droppedWords.length);
    const to = (replacement[replacement.length - 1] ?? head).replace(/[,.;:!?]+$/, '');
    if (from && to && bare(from) !== bare(to)) changes.push({ kind: 'correction', from, to });
    text = `${lead}${lead && !/\s$/.test(lead) ? ' ' : ''}${keep.join(' ')}${keep.length ? ' ' : ''}${after}`;
  }
  return text;
}

function applyRetractions(input: string, changes: SpeechChange[]): string {
  let text = input;
  for (let guard = 0; guard < 20; guard++) {
    const m = RETRACT_RE.exec(text);
    if (!m) break;
    // "…about cats. Scratch that." retracts the sentence that just ended.
    const before = text.slice(0, m.index).replace(/[.!?\s]+$/, '');
    let cut = 0;
    for (let i = before.length - 1; i >= 0; i--) {
      if (SENTENCE_END.test(before[i]!)) {
        cut = i + 1;
        break;
      }
    }
    text = `${before.slice(0, cut)} ${text.slice(m.index + m[0].length)}`;
    changes.push({ kind: 'retraction' });
  }
  return text;
}

const FILLER_RE =
  /(^|[\s,])(?:um+|uh+|uhm+|erm+|er|ah+|hmm+|mm+|you know|i guess|basically|so yeah|okay so|ok so|alright so)(?=[\s,.!?…]|$)[,…]*/gi;

function tidy(input: string): string {
  let t = input
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/([,;:])(?:\s*[,;:])+/g, '$1')
    .replace(/\.{2,}|…/g, '.')
    .replace(/([.!?])(?:\s*[,.])+/g, '$1')
    .replace(/^[\s,.;:]+/, '')
    .trim();
  // Sentence case.
  t = t.replace(/(^|[.!?]\s+)(\p{Ll})/gu, (_, lead: string, ch: string) => lead + ch.toUpperCase());
  return t;
}

/** Removes spoken slips, fillers and stutters. The wording is otherwise left as spoken. */
export function cleanSpeech(raw: string): string {
  return clean(raw, []);
}

function clean(raw: string, changes: SpeechChange[]): string {
  let t = raw.replace(/\s+/g, ' ').trim();
  if (!t) return '';
  t = applyRetractions(t, changes);
  t = applyCorrections(t, changes);
  let fillers = 0;
  t = t.replace(FILLER_RE, (_, lead: string) => {
    fillers++;
    return lead;
  });
  // Stutters: "the the", "I I".
  t = t.replace(/\b([\p{L}']+)(?:[,\s]+\1\b)+/giu, (_, word: string) => {
    fillers++;
    return word;
  });
  if (fillers > 0) changes.push({ kind: 'fillers', count: fillers });
  t = tidy(t);
  if (t && !/[.!?]$/.test(t)) t += '.';
  return t;
}

interface Cue {
  kind: SlotKind;
  re: RegExp;
}

/**
 * Spoken ways of adding context. Each cue starts a slot whose value runs to the next cue or
 * the end of the sentence. A captured group is kept as the start of the value ("under").
 */
const CUES: Cue[] = [
  {
    kind: 'tone',
    re: /\b(?:add (?:a |the )?tone(?: of)?[:,]?|(?:and )?(?:the |its )?tone (?:should be|is|will be|of)|tone[:,]|make it sound|(?:it|this) should sound)\s+/gi,
  },
  {
    kind: 'purpose',
    re: /\b(?:add (?:a |the )?purpose[:,]?|(?:and )?(?:the |its |my )?(?:purpose|goal|aim) (?:is|was)|purpose[:,])\s+/gi,
  },
  {
    kind: 'audience',
    re: /\b(?:add (?:an? |the )?audience[:,]?|(?:and )?(?:the |my )?audience (?:is|are|will be)|audience[:,]|(?:it'?s|this is) (?:aimed at|meant for))\s+/gi,
  },
  {
    kind: 'format',
    re: /\b(?:add (?:a |the )?format[:,]?|(?:and )?(?:the )?format (?:should be|is)|format[:,]|format it as)\s+/gi,
  },
  {
    kind: 'length',
    re: /\b(?:add (?:a |the )?length[:,]?|(?:and )?(?:the )?length (?:should be|is)|length[:,]|(?:and )?(?:keep|make) it (to|under|below|around|within|no more than|at most|about)|(?:and )?(no (?:more|longer) than)|limit it to)\s+/gi,
  },
  {
    kind: 'context',
    re: /\b(?:add (?:some |more )?context[:,]?|for context[:,]?|context[:,]|(?:some )?background[:,])\s+/gi,
  },
];

const TRAILING_JOINER_RE = /(?:[,;:]|\s+(?:and|but|also|then|plus|so))+\s*$/i;
const LEADING_VALUE_RE = /^(?:to be|be|is|are|that it'?s|of|:)\s+/i;

const POLITE_START_RE =
  /^(?:(?:hey|hi|hello|okay|ok|so|well|alright)[,!\s]+)*(?:(?:claude|chatgpt|gemini|there)[,!\s]+)?(?:(?:can|could|would|will) you (?:please |kindly )?(?:help me (?:out )?(?:and |to )?)?|please (?:can you |could you )?|i (?:want|need|would like|'d like) you to |i was wondering if you could )/i;
const POLITE_END_RE =
  /[,.\s]*(?:please|thanks(?: so much| a lot)?(?: in advance)?|thank you(?: so much| very much)?(?: in advance)?|i(?: really)? appreciate it|if you (?:can|could))[.!\s]*$/i;

function sentenceCase(s: string): string {
  return s.replace(/^\p{Ll}/u, (c) => c.toUpperCase());
}

/**
 * The refined prompt for a piece of dictated speech: the task as one tight instruction, then
 * the context that was spoken, one labeled line each. Saying a slot again replaces it.
 */
export function refineSpeech(raw: string): SpokenPrompt {
  const changes: SpeechChange[] = [];
  const cleaned = clean(raw, changes);
  if (!cleaned) return { cleaned: '', prompt: '', task: '', slots: {}, changes: [] };

  // Find every cue, in order.
  const found: { kind: SlotKind; start: number; end: number; lead: string }[] = [];
  for (const cue of CUES) {
    cue.re.lastIndex = 0;
    for (let m = cue.re.exec(cleaned); m; m = cue.re.exec(cleaned)) {
      found.push({
        kind: cue.kind,
        start: m.index,
        end: m.index + m[0].length,
        lead: (m[1] ?? m[2] ?? '').trim(),
      });
    }
  }
  // "…in a friendly tone": the value sits inside the cue.
  const inline = /\bin an? ([\p{L} ,-]{2,40}?) (?:tone|voice)\b/giu;
  const slots: Partial<Record<SlotKind, string>> = {};
  let task = cleaned;
  for (let m = inline.exec(cleaned); m; m = inline.exec(cleaned)) {
    slots.tone = m[1]!.trim();
    task = task.replace(m[0], ' ');
  }

  found.sort((a, b) => a.start - b.start);
  const spans: [number, number][] = [];
  found.forEach((cue, i) => {
    if (i > 0 && cue.start < found[i - 1]!.end) return; // overlapping cue
    const nextCue = found.slice(i + 1).find((c) => c.start >= cue.end)?.start ?? cleaned.length;
    const rest = cleaned.slice(cue.end, nextCue);
    const stop = rest.search(/[.!?](?:\s|$)/);
    const valueEnd = cue.end + (stop === -1 ? rest.length : stop);
    let value = cleaned.slice(cue.end, valueEnd);
    value = value.replace(TRAILING_JOINER_RE, '').replace(LEADING_VALUE_RE, '').trim();
    if (cue.lead) value = `${cue.lead} ${value}`;
    spans.push([cue.start, stop === -1 ? valueEnd : valueEnd + 1]);
    if (value) slots[cue.kind] = value;
  });

  // The task is whatever wasn't lifted out.
  for (const [start, end] of spans.sort((a, b) => b[0] - a[0])) {
    const original = cleaned.slice(start, end);
    task = task.replace(original, ' ');
  }
  task = tidy(task.replace(TRAILING_JOINER_RE, ''));
  const polite = task;
  task = task.replace(POLITE_START_RE, '').replace(POLITE_END_RE, '');
  if (task !== polite) changes.push({ kind: 'politeness' });
  task = tidy(task.replace(TRAILING_JOINER_RE, ''));
  task = sentenceCase(task);
  if (task && !/[.!?]$/.test(task)) task += '.';

  const lines = SLOT_KINDS.flatMap((kind) => {
    const value = slots[kind];
    return value ? [`${SLOT_LABELS[kind]}: ${sentenceCase(value).replace(/[.\s]+$/, '')}`] : [];
  });
  const prompt = [task, ...lines].filter(Boolean).join('\n');
  for (const kind of SLOT_KINDS) if (slots[kind]) changes.push({ kind: 'context', slot: kind });
  return { cleaned, prompt, task, slots, changes };
}

/** Ordered: the first match wins, so more specific kinds of request come first. */
const USE_CASE_HINTS: [UseCase, RegExp][] = [
  [
    'coding',
    /\b(?:code|coding|function|bug|script|api|endpoint|class|component|refactor|debug|typescript|javascript|python|java|sql|regex|unit tests?|compile|deploy|database|repo|pull request|stack trace)\b/,
  ],
  ['summarization', /\b(?:summari[sz]e|summary|tl;?dr|recap|key points|main points)\b/],
  ['extraction', /\b(?:extract|pull out|parse|list (?:all|every) (?:the )?[\w-]+ (?:in|from))\b/],
  ['brainstorming', /\b(?:brainstorm|ideas?|names? for|come up with|suggestions? for)\b/],
  [
    'writing',
    /\b(?:write|draft|compose|rewrite|reword|email|letter|post|blog|essay|article|caption|speech|toast|message|announcement|bio|cover letter|newsletter|story|poem|script for)\b/,
  ],
  [
    'analysis',
    /\b(?:analy[sz]e|compare|evaluate|review|assess|pros and cons|research|trade-?offs?|critique)\b/,
  ],
];

/**
 * A best guess at what a spoken prompt is for, so someone dictating doesn't have to pick a
 * use case. Keyword-based; falls back to Q&A.
 */
export function guessUseCase(text: string): UseCase {
  const lower = text.toLowerCase();
  return USE_CASE_HINTS.find(([, re]) => re.test(lower))?.[0] ?? 'qa';
}
