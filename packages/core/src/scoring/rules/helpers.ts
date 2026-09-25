import {
  findAttachmentReferences,
  subjectOverlap,
  type AttachmentReferences,
} from '../../attachments';
import { DATA_TAGS, type TextFeatures } from '../../text/analyze';
import type { RuleContext } from '../types';

export const TASK_VERBS = [
  'write',
  'create',
  'explain',
  'summarize',
  'summarise',
  'list',
  'generate',
  'analyze',
  'analyse',
  'compare',
  'translate',
  'fix',
  'refactor',
  'build',
  'design',
  'draft',
  'rewrite',
  'classify',
  'extract',
  'review',
  'describe',
  'give',
  'tell',
  'help',
  'make',
  'find',
  'calculate',
  'convert',
  'suggest',
  'plan',
  'outline',
  'implement',
  'debug',
  'identify',
  'evaluate',
  'recommend',
  'answer',
  'define',
  'show',
  'propose',
  'brainstorm',
  'edit',
  'proofread',
  'improve',
  'optimize',
  'optimise',
  'critique',
  'research',
  'produce',
  'compose',
  'format',
  'parse',
  'categorize',
  'rank',
  'score',
  'test',
  'check',
  'return',
  'output',
  'provide',
  'prepare',
  'teach',
  'solve',
  'estimate',
  'map',
  'name',
  'develop',
  'code',
  'add',
  'update',
  'remove',
  'port',
  'migrate',
  'document',
  'predict',
  'need',
  'want',
  'looking',
] as const;

const TASK_VERB_RE = new RegExp(`\\b(?:${TASK_VERBS.join('|')})\\b`);
const QUESTION_START_RE =
  /^(?:what|how|why|when|where|which|who|whom|whose|can|could|should|would|is|are|does|do|did|will)\b/;

export function hasTask(f: TextFeatures): boolean {
  const lower = f.instructionLower.trim();
  return f.questionMarks > 0 || TASK_VERB_RE.test(lower) || QUESTION_START_RE.test(lower);
}

export function isInstructionLine(line: string): boolean {
  const l = line
    .trim()
    .toLowerCase()
    .replace(/^(?:[-*•]|\d+[.)])\s+/, '');
  if (!l || l.length > 400) return false;
  return (
    l.includes('?') ||
    QUESTION_START_RE.test(l) ||
    new RegExp(`^(?:please\\s+)?(?:${TASK_VERBS.join('|')})\\b`).test(l)
  );
}

/**
 * Where the last instruction/question sits, as a fraction of the prompt (0 = top, 1 = end).
 * Lines inside fenced code are skipped: they are data, not the ask.
 */
export function lastInstructionPosition(text: string): number | null {
  const lines = text.split('\n');
  let offset = 0;
  let inFence = false;
  let last: number | null = null;
  for (const line of lines) {
    if (line.trim().startsWith('```')) inFence = !inFence;
    else if (!inFence && isInstructionLine(line)) last = offset;
    offset += line.length + 1;
  }
  return last === null || text.length === 0 ? null : last / text.length;
}

/** Counts phrase occurrences longest-first so "could you please" isn't also counted as "please". */
export function countPhrases(
  lower: string,
  phrases: readonly string[],
): { hits: string[]; words: number } {
  let remaining = ` ${lower} `;
  const hits: string[] = [];
  let words = 0;
  for (const phrase of [...phrases].sort((a, b) => b.length - a.length)) {
    const re = new RegExp(
      `(?<![\\p{L}\\p{N}'])${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}'])`,
      'gu',
    );
    const n = remaining.match(re)?.length ?? 0;
    if (n > 0) {
      hits.push(...Array<string>(n).fill(phrase));
      words += n * phrase.split(/\s+/).length;
      remaining = remaining.replace(re, ' ');
    }
  }
  return { hits, words };
}

export function unique(xs: string[]): string[] {
  return [...new Set(xs)];
}

/** Uppercase emphasis words the vendors warn about ("CRITICAL: you MUST ..."). */
export const EMPHATIC_CAPS = [
  'MUST',
  'NEVER',
  'ALWAYS',
  'CRITICAL',
  'IMPORTANT',
  'ABSOLUTELY',
  'ESSENTIAL',
  'MANDATORY',
  'REQUIRED',
  'EXTREMELY',
  'VERY',
  'REALLY',
  'DO NOT',
  "DON'T",
  'NOT',
  'ONLY',
  'STRICTLY',
] as const;

export function findEmphasis(text: string): string[] {
  const hits: string[] = [];
  for (const word of EMPHATIC_CAPS) {
    const re = new RegExp(`(?<![A-Za-z])${word}(?![A-Za-z])`, 'g');
    hits.push(...(text.match(re) ?? []));
  }
  hits.push(...(text.match(/!{2,}/g) ?? []));
  return hits;
}

/** Heuristic: the prompt contains material to operate on (pasted text, code, documents). */
export function hasMaterial(f: TextFeatures): boolean {
  const longestParagraph = Math.max(
    0,
    ...f.text.split(/\n\s*\n/).map((p) => p.match(/[\p{L}\p{N}]+/gu)?.length ?? 0),
  );
  return (
    f.codeBlocks > 0 ||
    // Material wrapped in data tags: <code>…</code>, <document>…</document>, <email>…</email>.
    f.xmlTags.some((t) => DATA_TAGS.has(t)) ||
    (longestParagraph >= 50 && f.words.length >= 80) ||
    f.words.length - f.instructionWords.length > 40 ||
    f.words.length > 150 ||
    (/:\s*\n/.test(f.text) && f.chars > 400) ||
    /["“][^"”]{120,}["”]/.test(f.text)
  );
}

export const STOPWORDS = new Set(
  (
    'a an the and or but if then so of to in on at by for with from as is are was were be been being ' +
    "it its it's this that these those i me my we our you your he she they them their what which who whom " +
    'do does did have has had can could would should will shall may might must not no yes also just ' +
    'very really about into over under again further once here there when where why how all any both ' +
    'each few more most other some such only own same than too s t don now please like get got make ' +
    "up out off one two three am im i'm let us thing things stuff something anything everything"
  ).split(' '),
);

/** Nouns that name the kind of output, not what it is about ("write an essay"). */
const DELIVERABLES = new Set(
  (
    'essay essays story stories poem poems article articles post posts blog email emails letter letters ' +
    'report reports summary summaries list lists code function functions script scripts program app apps ' +
    'website site page pages text paragraph paragraphs speech song songs joke jokes tweet tweets caption ' +
    'captions description descriptions plan plans outline answer answers response responses content copy ' +
    'document documents doc docs presentation slides lesson recipe recipes name names idea ideas analysis ' +
    'review question questions draft version bit piece words sentence sentences points bullets bullet ' +
    'thread threads message messages info information help advice suggestions tips options'
  ).split(' '),
);

/** Adjectives that say nothing about the subject. */
const EMPTY_MODIFIERS = new Set(
  (
    'good great nice short long quick simple detailed brief cool interesting new best better creative ' +
    'funny professional full complete small big little fun awesome amazing perfect proper decent random ' +
    'general basic whole entire sure okay ok'
  ).split(' '),
);

const TASK_VERB_SET = new Set<string>(TASK_VERBS);

/**
 * Words that say what the prompt is *about*: instruction words minus stopwords, task
 * verbs, deliverable nouns ("essay") and empty modifiers ("good"). "Write an essay" has
 * none; "Write an essay on the causes of World War I" has several.
 */
export function subjectWords(f: TextFeatures): string[] {
  return f.instructionWords
    .map((w) => w.toLowerCase())
    .filter(
      (w) =>
        w.length > 2 &&
        !/^\d+$/.test(w) &&
        !STOPWORDS.has(w) &&
        !TASK_VERB_SET.has(w) &&
        !DELIVERABLES.has(w) &&
        !EMPTY_MODIFIERS.has(w),
    );
}

/**
 * Concrete details the model couldn't guess: numbers, names (capitalized words that
 * don't start a sentence), and quoted phrases.
 */
export function concreteDetails(f: TextFeatures): string[] {
  const out: string[] = [];
  const text = f.instructionText;
  out.push(...(text.match(/\b\d[\d,.:%$]*\b/g) ?? []));
  for (const m of text.matchAll(/(?<![.!?]\s|^|\n)(?<=\s)([A-Z][\p{L}\p{N}&'-]+)/gu)) {
    if (m[1] !== 'I' && !/^I['’]/.test(m[1]!)) out.push(m[1]!);
  }
  out.push(...(text.match(/["“][^"”\n]{3,80}["”]/g) ?? []));
  return out;
}

const PRODUCE_RE =
  /\b(?:write|create|generate|draft|compose|make|build|design|produce|develop|come up with|brainstorm)\b/;

/** "Write/create/generate X" asks for new content, which needs context whatever the use case. */
export function isProductionTask(f: TextFeatures): boolean {
  return PRODUCE_RE.test(f.instructionLower);
}

/**
 * Things people ask a model to work on. "my resume", "this essay", "the attached report":
 * the prompt refers to material that has to be supplied (pasted, attached, or earlier in
 * the chat).
 */
const DOC_NOUNS =
  'r[eé]sum[eé]s?|cvs?|cover letters?|portfolios?|essays?|papers?|thes[ie]s|dissertations?|reports?|articles?|emails?|letters?|drafts?|code|codebase|scripts?|functions?|documents?|docs?|files?|pdfs?|spreadsheets?|slides?|decks?|presentations?|proposals?|contracts?|stor(?:y|ies)|poems?|chapters?|manuscripts?|notes|transcripts?|websites?|landing pages?|bios?|linkedin(?: profile)?|profiles?|personal statements?|statements?|applications?|posts?|blog posts?|speech(?:es)?|syllab(?:us|i)|business plans?|pitch(?: deck)?|screenshots?|photos?|images?|pictures?|data|dataset|messages?|texts?|writing|work|assignment|homework|answers?|solutions?|query|sql|design|mockups?|logo';
const MATERIAL_REF_RE = new RegExp(
  `\\b(?:my|our|this|these|the|attached|his|her|their|that|those)\\s+(?:[\\w'-]+\\s+){0,2}?(?:${DOC_NOUNS})\\b`,
);

/** Material that is itself visual, so an attached image can be it. */
export const VISUAL_NOUN_RE =
  /\b(?:screenshots?|photos?|images?|pictures?|design|mockups?|logo|slides?|decks?|charts?|diagrams?)\b/;

/** Returns the phrase that points at material ("my resume"), or null. */
export function materialReference(f: TextFeatures): string | null {
  return MATERIAL_REF_RE.exec(f.instructionLower)?.[0] ?? null;
}

const REVIEW_RE =
  /\b(?:review|critique|proofread|edit|improve|feedback|evaluate|assess|grade|rate|check|polish|tailor|optimi[sz]e|fix|rewrite|revise|tighten|refine|look (?:over|at)|go over|what(?:'s| is) wrong|what to (?:improve|change|fix)|how (?:can|could|do|should) i improve)\b/;

/**
 * A request to judge or improve specific material ("review my resume", "fix this code").
 * These need the material itself, a goal, and a yardstick, whatever the use case.
 */
export function isReviewTask(f: TextFeatures): boolean {
  return REVIEW_RE.test(f.instructionLower) && (materialReference(f) !== null || hasMaterial(f));
}

export interface FileUse extends AttachmentReferences {
  /** Files are attached to this message. */
  present: boolean;
  /**
   * The prompt uses the files: it refers to them, or there's exactly one file and the
   * prompt names no other topic ("Summarize this"), so the file can only be the subject.
   */
  used: boolean;
  /**
   * Used files carry content we can check: text (a PDF's text layer, a document) that
   * matches the prompt's topic, or images the prompt explicitly points at. An image we
   * can't read, or a file the prompt never names, earns no context credit.
   */
  substantive: boolean;
  /**
   * A used file is a brief, spec, rubric or job description: it can carry the purpose,
   * audience and requirements. Material to work on (a resume, an essay, code) can't:
   * it doesn't say what job you're applying for or what "better" means.
   */
  instructional: boolean;
  /** None of the prompt's topic words appear in the attached text (null: too little to compare). */
  mismatch: boolean;
}

/** "Summarize this" / "fix it": with a file attached and almost no other words, the pronoun is the file. */
const BARE_FILE_PRONOUN_RE = /\b(?:this|these|it|them)\b/;
/** The prompt points at an image by what it is. */
const IMAGE_WORD_RE =
  /\b(?:images?|photos?|pictures?|pics?|screenshots?|screen ?shots?|diagrams?|charts?|graphs?|figures?|logos?|graphics?|drawings?|sketch(?:es)?|scans?|designs?|mockups?|wireframes?|ui|screens?|slides?)\b/;
const INSTRUCTION_FILE =
  'briefs?|assignments?|specs?|specifications?|requirements?|rubrics?|guidelines?|instructions?|job (?:descriptions?|postings?|ads?|listings?)|jds?|postings?|style guides?|templates?|criteria|syllab(?:us|i)|prompts?|rfps?|terms of reference|scope of work|sow';
const INSTRUCTION_FILE_NAME_RE = new RegExp(`(?:^|[^a-z])(?:${INSTRUCTION_FILE})(?:[^a-z]|$)`);
const INSTRUCTION_FILE_REF_RE = new RegExp(
  `\\b(?:attached|this|the|these|that|uploaded|following)\\s+(?:[\\w-]+\\s+){0,2}?(?:${INSTRUCTION_FILE})\\b`,
);

export function fileUse(ctx: Pick<RuleContext, 'attachments' | 'features'>): FileUse {
  const { attachments, features } = ctx;
  const lower = features.instructionLower;
  const present = attachments.length > 0;
  const refs = findAttachmentReferences(lower, attachments);
  if (
    present &&
    !refs.any &&
    features.instructionWords.length < 10 &&
    BARE_FILE_PRONOUN_RE.test(lower)
  ) {
    refs.any = true;
  }
  const subject = subjectWords(features);
  const implicit = attachments.length === 1 && subject.length < 2;
  const used = present && (refs.any || implicit);
  const mismatch = used && subjectOverlap(subject, attachments) === 0;

  const readable = attachments.filter((a) => a.textChars >= 300);
  const images = attachments.filter((a) => a.kind === 'image');
  const imagesPointedAt =
    images.length > 0 &&
    (IMAGE_WORD_RE.test(lower) || images.some((a) => refs.named.includes(a.name)));
  const substantive = used && !mismatch && (readable.length > 0 || imagesPointedAt);
  const instructional =
    substantive &&
    readable.length > 0 &&
    (readable.some((a) => INSTRUCTION_FILE_NAME_RE.test(a.name.toLowerCase())) ||
      INSTRUCTION_FILE_REF_RE.test(lower));

  return { ...refs, present, used, substantive, instructional, mismatch };
}
