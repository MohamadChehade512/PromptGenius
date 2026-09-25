import { S } from '../sources';
import type { Rule } from '../types';
import { STOPWORDS, countPhrases, findEmphasis, unique } from './helpers';
import { UNBOUNDED_RE } from './output';

const FILLER = [
  'please',
  'kindly',
  'could you please',
  'can you please',
  'would you please',
  'could you',
  'can you',
  'would you',
  'i was wondering if',
  'i was wondering',
  'would you mind',
  "if you don't mind",
  'thank you',
  'thanks',
  'thanks in advance',
  'thank you so much',
  'i would like you to',
  'i want you to',
  'i need you to',
  'i would really appreciate',
  'just',
  'basically',
  'actually',
  'really',
  'very',
  'literally',
  'honestly',
  'hello',
  'hi',
  'hey',
  'hi there',
  'i hope you are well',
  "i hope you're doing well",
  'if possible',
  'if you can',
  'as an ai',
  'as an ai language model',
  'feel free to',
  'go ahead and',
  'for me',
] as const;

function normalizeSentence(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const economyRules: Rule[] = [
  {
    id: 'economy.filler',
    dimension: 'economy',
    title: 'Filler and politeness',
    sources: [S.principled, S.politeness, S.anthropicContextEng],
    evaluate: ({ features }) => {
      const total = features.instructionWords.length;
      if (total === 0) return null;
      const { hits, words } = countPhrases(features.instructionLower, FILLER);
      const ratio = words / total;
      if (ratio <= 0.05) return null;
      return {
        penalty: Math.min(0.6, (ratio - 0.03) * 4),
        message: `${words} of ${total} instruction words are filler, which adds tokens on every turn without adding signal.`,
        suggestion:
          'Cut courtesy and hedging phrases; state the request directly. Models don\'t need "please" to comply.',
        evidence: unique(hits),
      };
    },
  },
  {
    id: 'economy.duplicate-sentences',
    dimension: 'economy',
    title: 'Repeated sentences',
    sources: [S.anthropicContextEng, S.llmlingua, S.microsoftPromptEng],
    evaluate: ({ features }) => {
      const seen = new Set<string>();
      const dups: string[] = [];
      for (const s of features.sentences) {
        const n = normalizeSentence(s);
        if (n.length < 20) continue;
        if (seen.has(n)) dups.push(s);
        else seen.add(n);
      }
      if (dups.length === 0) return null;
      return {
        penalty: Math.min(0.5, 0.15 * dups.length),
        message: `${dups.length} sentence${dups.length > 1 ? 's are' : ' is'} repeated.`,
        suggestion:
          'Say each thing once. Repetition costs tokens and can over-weight that instruction.',
        evidence: dups.slice(0, 3),
      };
    },
  },
  {
    id: 'economy.repetitive-phrasing',
    dimension: 'economy',
    title: 'Repetitive phrasing',
    sources: [S.llmlingua, S.anthropicContextEng],
    evaluate: ({ features }) => {
      const words = features.instructionWords.map((w) => w.toLowerCase());
      const counts = new Map<string, number>();
      for (let i = 0; i + 4 <= words.length; i++) {
        const gram = words.slice(i, i + 4);
        if (gram.every((w) => STOPWORDS.has(w))) continue;
        const key = gram.join(' ');
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      const repeated = [...counts].filter(([, n]) => n >= 3).map(([g]) => g);
      if (repeated.length === 0) return null;
      return {
        penalty: Math.min(0.4, 0.2 * repeated.length),
        message: 'The same phrases appear three or more times.',
        suggestion: 'Consolidate repeated phrasing into a single rule or list.',
        evidence: repeated.slice(0, 3),
      };
    },
  },
  {
    id: 'economy.emphasis',
    dimension: 'economy',
    title: 'Shouting / over-emphasis',
    sources: [S.anthropicEmphasis, S.geminiStrategies],
    evaluate: ({ features }) => {
      const hits = findEmphasis(features.instructionText);
      if (hits.length === 0) return null;
      return {
        penalty: Math.min(0.3, 0.08 * hits.length),
        message: `ALL-CAPS emphasis (${unique(hits).join(', ')}) adds tokens and can make models over-apply the rule.`,
        suggestion: 'Use normal case and explain why the rule matters instead.',
        evidence: unique(hits),
      };
    },
  },
  {
    id: 'economy.low-density',
    dimension: 'economy',
    title: 'Low information density',
    sources: [S.anthropicContextEng, S.llmlingua],
    evaluate: ({ features }) => {
      const words = features.instructionWords;
      if (words.length < 40) return null;
      const content = words.filter((w) => !STOPWORDS.has(w.toLowerCase())).length;
      const density = content / words.length;
      if (density >= 0.42) return null;
      return {
        penalty: 0.3,
        message: `Only ${Math.round(density * 100)}% of the instruction words carry content.`,
        suggestion:
          'Tighten sentences: aim for "the smallest set of high-signal tokens" that gets the result.',
      };
    },
  },
  {
    id: 'economy.unbounded-output',
    dimension: 'economy',
    title: 'Unbounded output request',
    sources: [S.anthropicPricing, S.openaiPricing, S.openaiGpt5],
    evaluate: ({ features }) => {
      const m = UNBOUNDED_RE.exec(features.instructionLower);
      if (!m) return null;
      return {
        penalty: 0.4,
        message: `"${m[0]}" asks for open-ended output, and output tokens are the most expensive part of a call.`,
        suggestion:
          'Fine if you truly need it; otherwise cap it (e.g. "the 5 most important points").',
        evidence: [m[0]],
      };
    },
  },
  {
    id: 'economy.whitespace',
    dimension: 'economy',
    title: 'Wasted whitespace',
    sources: [S.microsoftPromptEng],
    evaluate: ({ features }) => {
      const text = features.text.replace(/```[\s\S]*?(?:```|$)/g, '');
      const runs = text.match(/(?<=\S)[ \t]{3,}|[ \t]+$|\n{4,}/gm) ?? [];
      const wasted = runs.reduce((sum, r) => sum + r.length - 1, 0);
      if (wasted < 20 || wasted / Math.max(1, text.length) < 0.03) return null;
      return {
        penalty: 0.2,
        message: `About ${wasted} characters of extra spaces and blank lines. Consecutive whitespace is tokenized separately and wastes space.`,
        suggestion:
          'Collapse runs of spaces, trailing spaces and extra blank lines (code indentation is fine).',
      };
    },
  },
];
