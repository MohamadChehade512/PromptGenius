/**
 * Language-agnostic structural features of a prompt, computed once and shared by the
 * estimators and every scoring rule.
 */
export interface TextFeatures {
  text: string;
  /** Prompt with fenced code and data-like XML blocks removed: the part the user wrote as instructions. */
  instructionText: string;
  lower: string;
  instructionLower: string;
  chars: number;
  words: string[];
  instructionWords: string[];
  sentences: string[];
  paragraphs: number;
  lines: number;
  codeBlocks: number;
  xmlTags: string[];
  markdownHeadings: number;
  labeledSections: number;
  separators: number;
  listItems: number;
  questionMarks: number;
}

const WORD_RE = /[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu;
const FENCE_RE = /```[\s\S]*?(?:```|$)/g;
const XML_BLOCK_RE = /<([a-zA-Z_][\w-]*)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g;
/** XML tags whose content is data to operate on, not instructions. */
export const DATA_TAGS = new Set([
  'document',
  'documents',
  'document_content',
  'data',
  'input',
  'text',
  'article',
  'email',
  'code',
  'source',
  'transcript',
  'example',
  'examples',
  'report',
]);
const LABEL_RE =
  /^\s*(?:#+\s*)?(task|context|background|instructions?|input|output|format|examples?|constraints?|goal|objective|role|audience|data|question|requirements?|rules|tone|style|persona|steps|notes?|success criteria)\s*:/gim;

function matchCount(text: string, re: RegExp): number {
  return text.match(re)?.length ?? 0;
}

/** Words that mark a paragraph as written *to* the model rather than pasted material. */
const INSTRUCTION_MARKER_RE =
  /\b(?:you|your|i|i'm|i am|we|we're|our|please|write|summari[sz]e|explain|list|create|give|return|extract|analy[sz]e|identify|compare|rewrite|translate|answer)\b/i;

/** An untagged paragraph of 50+ words with no instruction markers is treated as pasted data. */
function isDataParagraph(paragraph: string): boolean {
  const words = paragraph.match(WORD_RE)?.length ?? 0;
  return words >= 50 && !INSTRUCTION_MARKER_RE.test(paragraph);
}

export function stripDataBlocks(text: string): string {
  let out = text.replace(FENCE_RE, ' ');
  out = out.replace(XML_BLOCK_RE, (_whole, tag: string, inner: string) =>
    DATA_TAGS.has(tag.toLowerCase()) ? ' ' : `${inner}`,
  );
  return out
    .split(/(\n\s*\n)/)
    .map((part) => (isDataParagraph(part) ? ' ' : part))
    .join('');
}

export function analyzeText(text: string): TextFeatures {
  const instructionText = stripDataBlocks(text);
  const xmlTags = [...text.matchAll(/<([a-zA-Z_][\w-]*)(?:\s[^>]*)?>/g)]
    .map((m) => m[1]!.toLowerCase())
    .filter((tag, i, all) => all.indexOf(tag) === i && text.includes(`</${tag}`));

  const trimmed = text.trim();
  return {
    text,
    instructionText,
    lower: text.toLowerCase(),
    instructionLower: instructionText.toLowerCase(),
    chars: text.length,
    words: text.match(WORD_RE) ?? [],
    instructionWords: instructionText.match(WORD_RE) ?? [],
    sentences: instructionText
      .split(/(?<=[.!?])\s+|\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
    paragraphs: trimmed ? trimmed.split(/\n\s*\n/).length : 0,
    lines: trimmed ? trimmed.split('\n').length : 0,
    codeBlocks: Math.floor(matchCount(text, /```/g) / 2),
    xmlTags,
    markdownHeadings: matchCount(text, /^#{1,6}\s+\S/gm),
    labeledSections: matchCount(text, LABEL_RE),
    separators: matchCount(text, /^\s*(?:---+|===+|\*\*\*+)\s*$/gm),
    listItems: matchCount(text, /^\s*(?:[-*•]|\d+[.)])\s+\S/gm),
    questionMarks: matchCount(instructionText, /\?/g),
  };
}

/** True when the prompt visibly separates sections (tags, headings, labels, fences, separators). */
export function hasStructure(f: TextFeatures): boolean {
  return (
    f.xmlTags.length > 0 ||
    f.markdownHeadings > 0 ||
    f.labeledSections >= 2 ||
    f.codeBlocks > 0 ||
    f.separators > 0
  );
}

/** Counts whole-word/phrase occurrences of any term (case-insensitive) and returns the hits. */
export function findTerms(lowerText: string, terms: readonly string[]): string[] {
  const hits: string[] = [];
  for (const term of terms) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(term)}(?![\\p{L}\\p{N}])`, 'gu');
    const n = lowerText.match(re)?.length ?? 0;
    for (let i = 0; i < n; i++) hits.push(term);
  }
  return hits;
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
