import type { ImageTokenSpec, MediaSpec, ModelSpec } from '../config';
import { estimateBaseTokens } from '../estimation/tokens';
import { STOPWORDS } from '../scoring/rules/helpers';

export type AttachmentKind = 'text' | 'pdf' | 'image';

/** What the browser extracted from a file. Nothing here leaves the user's machine. */
export interface AttachmentSource {
  id: string;
  name: string;
  kind: AttachmentKind;
  bytes: number;
  /** Extracted text (text files, PDF text layer, .docx body). Empty for images. */
  text?: string;
  pages?: number;
  width?: number;
  height?: number;
  /** The text was cut at the reading limit; token counts are scaled up to the full file. */
  truncatedRatio?: number;
}

/**
 * A model-independent summary of an attachment. It is computed once when the file is
 * added, so re-scoring on every keystroke never re-reads a large file.
 */
export interface Attachment {
  id: string;
  name: string;
  kind: AttachmentKind;
  bytes: number;
  /** o200k-baseline token estimate of the extracted text (see estimateBaseTokens). */
  baseTextTokens: number;
  textChars: number;
  pages?: number;
  width?: number;
  height?: number;
  /** Distinctive word stems in the file, for checking that the prompt's topic is in it. */
  terms: string[];
}

const TERM_LIMIT = 4000;
const STEM = 5;

export function stem(word: string): string {
  return word.toLowerCase().slice(0, STEM);
}

export function summarizeAttachment(src: AttachmentSource): Attachment {
  const text = src.text ?? '';
  const scale = src.truncatedRatio && src.truncatedRatio > 1 ? src.truncatedRatio : 1;
  const counts = new Map<string, number>();
  for (const w of text.match(/[\p{L}][\p{L}\p{N}'’-]+/gu) ?? []) {
    const lower = w.toLowerCase();
    if (lower.length < 4 || STOPWORDS.has(lower)) continue;
    const s = stem(lower);
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  const terms = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TERM_LIMIT)
    .map(([t]) => t);
  return {
    id: src.id,
    name: src.name,
    kind: src.kind,
    bytes: src.bytes,
    baseTextTokens: Math.round(estimateBaseTokens(text) * scale),
    textChars: Math.round(text.length * scale),
    pages: src.pages,
    width: src.width,
    height: src.height,
    terms,
  };
}

/**
 * A US Letter page rendered at 96 DPI. Neither Anthropic nor OpenAI publishes the size
 * they render PDF pages at, so the page-image share of a PDF is an estimate.
 */
export const PDF_PAGE_RENDER = { width: 816, height: 1056 } as const;

export interface ImageTokens {
  tokens: number;
  /** Size the vendor downscales the image to before counting. */
  width: number;
  height: number;
  downscaled: boolean;
}

/**
 * Vendor image-token rules. Patch schemes downscale (keeping the aspect ratio) until the
 * long edge and the patch count both fit, then bill ceil(w/p) × ceil(h/p) × multiplier.
 */
export function imageTokens(width: number, height: number, spec: ImageTokenSpec): ImageTokens {
  const w0 = Math.max(1, Math.round(width));
  const h0 = Math.max(1, Math.round(height));
  if (spec.scheme === 'fixed') {
    return { tokens: spec.tokens, width: w0, height: h0, downscaled: false };
  }
  const p = spec.patchPx;
  const patches = (w: number, h: number) => Math.ceil(w / p) * Math.ceil(h / p);
  const size = (scale: number) => ({
    w: Math.max(1, Math.floor(w0 * scale)),
    h: Math.max(1, Math.floor(h0 * scale)),
  });
  const fits = (scale: number) => {
    const { w, h } = size(scale);
    return patches(w, h) <= spec.maxPatches;
  };
  // Largest scale that fits the long edge, then the largest that also fits the patch budget.
  let scale = Math.min(1, spec.maxLongEdge / Math.max(w0, h0));
  if (!fits(scale)) {
    let lo = 0;
    let hi = scale;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) lo = mid;
      else hi = mid;
    }
    scale = lo;
  }
  const { w, h } = size(scale);
  return {
    tokens: Math.round(patches(w, h) * spec.multiplier),
    width: w,
    height: h,
    downscaled: w !== w0 || h !== h0,
  };
}

export interface AttachmentTokens {
  id: string;
  name: string;
  kind: AttachmentKind;
  tokens: number;
  textTokens: number;
  visualTokens: number;
}

/** Input tokens one attachment costs on a given model. */
export function attachmentTokens(
  a: Attachment,
  model: Pick<ModelSpec, 'tokenizer'>,
  media: MediaSpec,
): AttachmentTokens {
  const text = Math.round(a.baseTextTokens * model.tokenizer.multiplier);
  let textTokens = 0;
  let visualTokens = 0;
  if (a.kind === 'text') {
    textTokens = text;
  } else if (a.kind === 'image') {
    visualTokens = imageTokens(a.width ?? 1024, a.height ?? 1024, media.image).tokens;
  } else {
    const pages = Math.max(1, a.pages ?? 1);
    const perPage =
      media.pdfPage.tokens ??
      imageTokens(PDF_PAGE_RENDER.width, PDF_PAGE_RENDER.height, media.image).tokens;
    visualTokens = pages * perPage;
    textTokens = media.pdfPage.includesText ? text : 0;
  }
  return {
    id: a.id,
    name: a.name,
    kind: a.kind,
    tokens: textTokens + visualTokens,
    textTokens,
    visualTokens,
  };
}

/** Phrases that point at an attached file without naming it. */
const GENERIC_REFERENCE_RE =
  /\b(?:attached|attachments?|enclosed|uploaded|(?:this|these|the|my|our|that|those|both|each|all)\s+(?:\w+\s)?(?:files?|documents?|docs?|pdfs?|images?|photos?|pictures?|screenshots?|spreadsheets?|sheets?|csvs?|reports?|briefs?|transcripts?|slides?|decks?|rubrics?|papers?|articles?|notes|chapters?|contracts?|resumes?|cvs?|receipts?|invoices?|logs?|diagrams?|charts?|scans?|drafts?|essays?|data|dataset|code|script|repo)|(?:image|file|document|photo|screenshot|page)\s+\d+|(?:above|below)\s+(?:file|document|image))\b/;

/** Words that pick out one of several files ("the second file", "both", "each"). */
const MULTI_REFERENCE_RE =
  /\b(?:both|each|all|every|first|second|third|last|other|former|latter|(?:image|file|document|photo|screenshot|page)\s+\d+)\b/;

/** Words that refer to the file itself, not its topic. */
const FILE_WORDS = new Set(
  (
    'attached attachment attachments enclosed uploaded file files document documents pdf pdfs ' +
    'image images photo photos picture screenshot screenshots spreadsheet sheet csv report brief ' +
    'transcript slides deck rubric paper notes chapter contract resume receipt invoice data dataset'
  ).split(' '),
);

function fileStem(name: string): string {
  return name
    .replace(/\.[a-z0-9]{1,5}$/i, '')
    .toLowerCase()
    .replace(/[_\-.]+/g, ' ')
    .trim();
}

export interface AttachmentReferences {
  /** The prompt points at the attachments at all ("the attached report", a file name). */
  any: boolean;
  /** Attachments whose file name appears in the prompt. */
  named: string[];
  /** With several files, the prompt says which one(s) to use. */
  distinguishes: boolean;
}

export function findAttachmentReferences(
  lowerPrompt: string,
  attachments: readonly Pick<Attachment, 'name'>[],
): AttachmentReferences {
  const prompt = lowerPrompt.replace(/[_-]+/g, ' ');
  const named = attachments
    .filter((a) => {
      const s = fileStem(a.name);
      return s.length >= 3 && prompt.includes(s);
    })
    .map((a) => a.name);
  const generic = GENERIC_REFERENCE_RE.test(lowerPrompt);
  return {
    any: generic || named.length > 0,
    named,
    distinguishes: named.length > 0 || MULTI_REFERENCE_RE.test(lowerPrompt),
  };
}

/**
 * Share of the prompt's subject words that also appear in the attached text. Low overlap
 * suggests the file doesn't match what the prompt is about (or the prompt should say
 * which part to use). Returns null when there's too little to compare.
 */
export function subjectOverlap(
  subjectWords: readonly string[],
  attachments: readonly Attachment[],
): number | null {
  const withText = attachments.filter((a) => a.textChars >= 500);
  const words = [
    ...new Set(
      subjectWords.filter((w) => w.length >= 4 && !FILE_WORDS.has(w.toLowerCase())).map(stem),
    ),
  ];
  if (withText.length === 0 || words.length < 3) return null;
  const terms = new Set(withText.flatMap((a) => a.terms));
  return words.filter((w) => terms.has(w)).length / words.length;
}
