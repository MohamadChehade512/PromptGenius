import { findTerms } from '../../text/analyze';
import { S } from '../sources';
import type { Rule } from '../types';
import {
  fileUse,
  hasMaterial,
  hasTask,
  isReviewTask,
  materialReference,
  subjectWords,
  unique,
} from './helpers';

const VAGUE_TERMS = [
  'something',
  'stuff',
  'things',
  'somehow',
  'whatever',
  'kind of',
  'sort of',
  'etc',
  'and so on',
  'some sort of',
  'nice',
  'cool',
  'various',
  'anything',
  'a bit',
  'good',
  'some stuff',
  'thing',
  'my thing',
  'etc.',
  'or something',
  'and stuff',
] as const;

/** Asks whose only verb is "help/need/want" with no concrete deliverable. */
const GENERIC_ASK_RE =
  /^(?:(?!\b(?:write|create|explain|summari[sz]e|list|generate|analy[sz]e|compare|translate|fix|refactor|build|design|draft|rewrite|classify|extract|review|describe|give|tell|make|find|calculate|convert|suggest|plan|outline|implement|debug|identify|evaluate|recommend|answer|define|show|propose|brainstorm|edit|proofread|improve|optimi[sz]e|research|produce|compose|return|provide|prepare|teach|solve|estimate|name|develop)\b).)*\b(?:help|need|want|assist)\b/s;
const REFERENT_RE =
  /\b(?:the above|below|attached|(?:the|my|our|this|these) (?:article|text|document|doc|email|emails|report|file|code|essay|paper|message|messages|data|spreadsheet|pdf|link|info|information|notes))\b/;
/** A bare "it/this" is only a dangling reference when there's almost nothing else to go on. */
const BARE_PRONOUN_RE = /\b(?:this|these|it|that)\b/;
const WANTS_BRIEF_RE =
  /\b(?:brief(?:ly)?|concise(?:ly)?|succinct(?:ly)?|tl;?dr|as short as possible|keep it short)\b/;
const WANTS_LONG_RE =
  /\b(?:detailed|comprehensive|in[- ]depth|thorough(?:ly)?|exhaustive(?:ly)?|extensive(?:ly)?|as long as possible|leave nothing out)\b/;
const MAX_WORDS_RE =
  /\b(?:under|less than|fewer than|no more than|at most|max(?:imum)?(?: of)?|up to)\s+(\d[\d,]*)\s+words?\b/;
const MIN_WORDS_RE =
  /\b(?:at least|minimum(?: of)?|no less than|more than|over)\s+(\d[\d,]*)\s+words?\b/;

/** Ends on a word that needs something after it ("review my resume and"). */
const UNFINISHED_RE =
  /(?:^|\s)(and|or|but|with|to|the|a|an|for|of|in|on|about|like|because|so|then|also|including|such as|e\.g\.|,)$/;

const num = (s: string | undefined) => Number((s ?? '').replace(/,/g, ''));

export const clarityRules: Rule[] = [
  {
    id: 'clarity.no-task',
    dimension: 'clarity',
    title: 'No clear task',
    sources: [S.anthropicClear, S.openaiPromptEng, S.vertexComponents],
    evaluate: ({ features }) =>
      hasTask(features)
        ? null
        : {
            penalty: 0.6,
            message: "The prompt doesn't say what you want the model to do.",
            suggestion:
              'Start with a direct instruction or question, e.g. "Summarize…", "Write…", "What is…?"',
          },
  },
  {
    id: 'clarity.no-subject',
    dimension: 'clarity',
    title: 'No topic',
    sources: [S.openaiBestPractices, S.vertexComponents, S.microsoftPromptEng, S.dairTips],
    evaluate: (ctx) => {
      const { features } = ctx;
      // No task is covered by clarity.no-task; pasted material or a used attachment *is* the topic.
      if (!hasTask(features) || hasMaterial(features) || fileUse(ctx).used) return null;
      const subject = subjectWords(features);
      if (subject.length >= 2 || (subject.length === 1 && features.instructionWords.length >= 8))
        return null;
      return {
        penalty: subject.length === 0 ? 0.8 : 0.35,
        message:
          subject.length === 0
            ? "The prompt says what to produce but not what it's about, so the model has to invent the topic."
            : `The only topic word is "${subject[0]}", which leaves the model guessing the angle and scope.`,
        suggestion:
          'Name the subject and angle, e.g. "an essay arguing that remote work helps small startups, using two real examples".',
        evidence: subject,
      };
    },
  },
  {
    id: 'clarity.generic-ask',
    dimension: 'clarity',
    title: 'Generic "help me" request',
    sources: [S.vertexComponents, S.openaiBestPractices],
    evaluate: ({ features }) =>
      GENERIC_ASK_RE.test(features.instructionLower) && features.instructionWords.length < 40
        ? {
            penalty: 0.35,
            message: '"Help me / I need" doesn\'t say what the help should look like.',
            suggestion:
              'Name the deliverable, e.g. "Give me 3 ways to…", "Rewrite this paragraph to…", "Explain…".',
          }
        : null,
  },
  {
    id: 'clarity.missing-referent',
    dimension: 'clarity',
    title: 'Refers to something not included',
    sources: [S.microsoftPromptEng, S.anthropicLongContext],
    evaluate: ({ features, historyTokens, attachments }) => {
      // In an ongoing chat, "it" and "the email" usually point at earlier messages; with a
      // file attached, they point at the file.
      if (
        historyTokens > 0 ||
        attachments.length > 0 ||
        hasMaterial(features) ||
        features.instructionWords.length >= 40
      )
        return null;
      const ref =
        REFERENT_RE.exec(features.instructionLower)?.[0] ??
        materialReference(features) ??
        (features.instructionWords.length < 10
          ? BARE_PRONOUN_RE.exec(features.instructionLower)?.[0]
          : undefined);
      if (!ref) return null;
      return {
        // Reviewing something that isn't there can't produce anything specific.
        penalty: isReviewTask(features) ? 0.6 : 0.4,
        message: `The prompt mentions "${ref}", but it isn't attached or in the prompt, so the model can't see it.`,
        suggestion:
          'Attach the file, paste the material into the prompt (e.g. inside <document>…</document>), or name exactly what you mean.',
        evidence: [ref],
      };
    },
  },
  {
    id: 'clarity.too-short',
    dimension: 'clarity',
    title: 'Very short prompt',
    sources: [S.dairTips, S.openaiBestPractices],
    evaluate: (ctx) => {
      const { features } = ctx;
      const n = features.instructionWords.length;
      if (n >= 12) return null;
      // A short instruction next to pasted or attached material is less ambiguous than a bare one.
      const k = hasMaterial(features) || fileUse(ctx).used ? 0.5 : 1;
      return {
        penalty: k * (n < 4 ? 0.7 : n < 6 ? 0.5 : 0.25),
        message: `Only ${n} words of instruction, so the model has to guess the details.`,
        suggestion:
          "Add the specifics a new colleague would need: what it's for, who it's for, and what a good answer looks like.",
      };
    },
  },
  {
    id: 'clarity.vague-words',
    dimension: 'clarity',
    title: 'Vague wording',
    sources: [S.dairTips, S.microsoftPromptEng],
    evaluate: ({ features }) => {
      const hits = findTerms(features.instructionLower, VAGUE_TERMS);
      if (hits.length === 0) return null;
      return {
        penalty: Math.min(0.45, 0.15 * hits.length),
        message: `Vague words leave room for interpretation: ${unique(hits)
          .map((h) => `"${h}"`)
          .join(', ')}.`,
        suggestion:
          'Replace each with the specific thing you mean (e.g. "good" → "under 100 words, friendly, no jargon").',
        evidence: unique(hits),
      };
    },
  },
  {
    id: 'clarity.contradiction',
    dimension: 'clarity',
    title: 'Contradictory instructions',
    sources: [S.openaiGpt5],
    evaluate: ({ features }) => {
      const lower = features.instructionLower;
      const brief = WANTS_BRIEF_RE.exec(lower);
      const long = WANTS_LONG_RE.exec(lower);
      const max = MAX_WORDS_RE.exec(lower);
      const min = MIN_WORDS_RE.exec(lower);
      let evidence: string[] | null = null;
      if (brief && long) evidence = [brief[0], long[0]];
      else if (max && min && num(min[1]) > num(max[1])) evidence = [max[0], min[0]];
      if (!evidence) return null;
      return {
        penalty: 0.35,
        message: `These instructions pull in opposite directions: "${evidence[0]}" vs "${evidence[1]}". Models spend effort (and tokens) reconciling them.`,
        suggestion:
          'Keep one, or say which wins, e.g. "brief overall, but detailed on the pricing section".',
        evidence,
      };
    },
  },
  {
    id: 'clarity.unfinished',
    dimension: 'clarity',
    title: 'Prompt looks unfinished',
    sources: [S.anthropicClear, S.openaiBestPractices],
    evaluate: ({ features }) => {
      const m = UNFINISHED_RE.exec(features.instructionText.trimEnd().toLowerCase());
      return m
        ? {
            penalty: 0.4,
            message: `The prompt ends with "${m[1]}", so it looks cut off and the model will guess the rest.`,
            suggestion: 'Finish the last sentence, or remove the trailing word.',
            evidence: [m[1]!],
          }
        : null;
    },
  },
  {
    id: 'clarity.many-questions',
    dimension: 'clarity',
    title: 'Many asks in one paragraph',
    sources: [S.microsoftPromptEng, S.anthropicClear],
    evaluate: ({ features }) =>
      features.questionMarks >= 4 && features.listItems < 2
        ? {
            penalty: 0.2,
            message: `${features.questionMarks} questions are mixed together, so some may get skipped.`,
            suggestion: 'Put multiple asks in a numbered list so each one gets answered.',
          }
        : null,
  },
];
