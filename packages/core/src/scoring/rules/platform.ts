import { S } from '../sources';
import type { Rule } from '../types';
import { countPhrases, findEmphasis, lastInstructionPosition, unique } from './helpers';

const NEGATIVE_RE = /\b(?:don'?t|do not|never|avoid|no)\b/g;
const POSITIVE_RE =
  /\b(?:use|write|include|make|keep|start|end|return|respond|answer|format|focus|prefer)\b/g;
const STEP_BY_STEP_RE =
  /\b(?:think step[- ]by[- ]step|let'?s think|reason step[- ]by[- ]step|show your (?:reasoning|work)|explain your reasoning step)\b/;
const ROLE_RE =
  /\b(?:you are|act as|your role|role:|identity:|as an? (?:expert|senior|experienced))\b/;
const PERSUASIVE = [
  'it is very important',
  "it's very important",
  'it is crucial',
  "it's crucial",
  'please make sure',
  'i really need',
  'it is essential',
  "it's essential",
  'extremely important',
  'this is critical',
  'my job depends',
  'i will tip',
  'you must',
  'absolutely must',
] as const;
const DETAIL_RE =
  /\b(?:detailed|in[- ]depth|thorough|comprehensive|elaborate|expand|explain in detail)\b/;

export const claudeRules: Rule[] = [
  {
    id: 'claude.aggressive-emphasis',
    dimension: 'platformFit',
    title: 'Aggressive emphasis',
    sources: [S.anthropicEmphasis],
    platforms: ['claude'],
    evaluate: ({ features }) => {
      const hits = findEmphasis(features.instructionText);
      if (hits.length < 2) return null;
      return {
        penalty: 0.5,
        message:
          'Recent Claude models are very responsive to instructions; "CRITICAL / MUST" language makes them over-trigger.',
        suggestion:
          'Rewrite as calm, direct instructions, e.g. "Use this tool when…" instead of "CRITICAL: you MUST…".',
        evidence: unique(hits),
      };
    },
  },
  {
    id: 'claude.xml-tags',
    dimension: 'platformFit',
    title: 'No XML tags for mixed content',
    sources: [S.anthropicXml],
    platforms: ['claude'],
    evaluate: ({ features, tokens }) =>
      tokens >= 300 && features.xmlTags.length === 0
        ? {
            penalty: 0.45,
            message:
              'Claude parses long prompts best when instructions, context and data are wrapped in XML tags.',
            suggestion:
              'Wrap each part: <context>…</context>, <instructions>…</instructions>, <document>…</document>.',
          }
        : null,
  },
  {
    id: 'claude.negative-instructions',
    dimension: 'platformFit',
    title: 'Mostly "don\'t" instructions',
    sources: [S.anthropicFormat, S.dairTips, S.principled],
    platforms: ['claude'],
    evaluate: ({ features }) => {
      const neg = features.instructionLower.match(NEGATIVE_RE)?.length ?? 0;
      const pos = features.instructionLower.match(POSITIVE_RE)?.length ?? 0;
      if (neg < 3 || neg <= pos) return null;
      return {
        penalty: 0.35,
        message: `${neg} "don't/never/avoid" instructions vs ${pos} positive ones.`,
        suggestion:
          'Tell Claude what to do instead, e.g. "write in flowing prose" rather than "don\'t use markdown".',
      };
    },
  },
];

export const openaiRules: Rule[] = [
  {
    id: 'openai.reasoning-micromanaged',
    dimension: 'platformFit',
    title: 'Micromanaging a reasoning model',
    sources: [S.openaiPromptEng, S.openaiReasoning, S.microsoftPromptEng],
    platforms: ['openai'],
    evaluate: ({ features, reasoning }) => {
      if (!reasoning) return null;
      const cot = STEP_BY_STEP_RE.test(features.instructionLower);
      if (!cot && features.listItems < 8) return null;
      return {
        penalty: 0.45,
        message: cot
          ? '"Think step by step" is unnecessary for reasoning models; they already reason internally (and bill it as output).'
          : 'A long step-by-step procedure constrains a reasoning model that works best from high-level goals.',
        suggestion:
          'Give the goal, constraints and success criteria, and let the model plan the steps.',
      };
    },
  },
  {
    id: 'openai.non-reasoning-steps',
    dimension: 'platformFit',
    title: 'Implicit steps for a non-reasoning model',
    sources: [S.openaiPromptEng, S.microsoftPromptEng, S.chainOfThought],
    platforms: ['openai'],
    useCases: ['coding', 'analysis', 'extraction'],
    evaluate: ({ features, reasoning, tokens }) =>
      !reasoning && tokens >= 40 && features.listItems < 2
        ? {
            penalty: 0.3,
            message:
              'With reasoning off, GPT models work best from explicit, precise instructions.',
            suggestion: 'Spell out the steps and the exact output you expect, as a numbered list.',
          }
        : null,
  },
  {
    id: 'openai.no-sections',
    dimension: 'platformFit',
    title: 'No identity / instruction sections',
    sources: [S.openaiPromptEng, S.openaiGpt5],
    platforms: ['openai'],
    evaluate: ({ features, tokens }) =>
      tokens >= 300 &&
      !ROLE_RE.test(features.instructionLower) &&
      features.labeledSections < 2 &&
      features.markdownHeadings === 0
        ? {
            penalty: 0.3,
            message:
              "OpenAI's recommended layout for longer prompts is Identity → Instructions → Examples → Context.",
            suggestion:
              'Add Markdown sections for those four parts; put reusable parts first so they can be cached.',
          }
        : null,
  },
];

export const geminiRules: Rule[] = [
  {
    id: 'gemini.persuasive-filler',
    dimension: 'platformFit',
    title: 'Persuasive language',
    sources: [S.geminiStrategies],
    platforms: ['gemini'],
    evaluate: ({ features }) => {
      const { hits } = countPhrases(features.instructionLower, PERSUASIVE);
      if (hits.length === 0) return null;
      return {
        penalty: Math.min(0.5, 0.25 * hits.length),
        message: 'Gemini 3 guidance says to be precise and direct and skip persuasive language.',
        suggestion: 'State the requirement plainly; drop "it is crucial / please make sure".',
        evidence: unique(hits),
      };
    },
  },
  {
    id: 'gemini.question-last',
    dimension: 'platformFit',
    title: 'Question not at the end',
    sources: [S.geminiStrategies, S.lostInMiddle],
    platforms: ['gemini'],
    evaluate: ({ features, tokens }) => {
      if (tokens < 300) return null;
      const pos = lastInstructionPosition(features.text);
      if (pos === null || pos >= 0.5) return null;
      return {
        penalty: 0.5,
        message:
          'For long prompts Gemini 3 works best with all context first and the specific question at the very end.',
        suggestion: 'Move your question/instruction below the material.',
      };
    },
  },
  {
    id: 'gemini.terse-default',
    dimension: 'platformFit',
    title: 'Detail level not requested',
    sources: [S.geminiStrategies],
    platforms: ['gemini'],
    useCases: ['writing', 'analysis'],
    evaluate: ({ features }) =>
      DETAIL_RE.test(features.instructionLower) ||
      /\b\d+\s+(?:words|paragraphs|pages)\b/.test(features.instructionLower)
        ? null
        : {
            penalty: 0.3,
            message: 'Gemini 3 answers tersely by default.',
            suggestion:
              'If you want depth, ask for it explicitly (e.g. "a detailed, 3-paragraph explanation").',
          },
  },
  {
    id: 'gemini.temperature',
    dimension: 'platformFit',
    title: 'Temperature tweaking',
    sources: [S.geminiStrategies, S.googleWhitepaper],
    platforms: ['gemini'],
    evaluate: ({ features }) =>
      /\btemperature\b/.test(features.instructionLower)
        ? {
            penalty: 0.2,
            message: 'Google recommends leaving Gemini 3 at its default temperature.',
            suggestion:
              'Steer behavior with instructions and examples instead of sampling settings.',
          }
        : null,
  },
];
