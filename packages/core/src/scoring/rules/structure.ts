import { hasStructure } from '../../text/analyze';
import { S } from '../sources';
import type { Rule } from '../types';
import { lastInstructionPosition } from './helpers';

export const structureRules: Rule[] = [
  {
    id: 'structure.no-delimiters',
    dimension: 'structure',
    title: 'No sections or delimiters',
    sources: [S.anthropicXml, S.openaiPromptEng, S.microsoftPromptEng, S.formatSensitivity],
    evaluate: ({ features, tokens }) =>
      tokens >= 150 && !hasStructure(features)
        ? {
            penalty: 0.6,
            message:
              'A longer prompt with no visible sections, so instructions, context and data run together.',
            suggestion:
              'Separate the parts with tags or headings, e.g. <context>…</context>, <instructions>…</instructions>, or "## Task" / "## Data".',
          }
        : null,
  },
  {
    id: 'structure.question-first',
    dimension: 'structure',
    title: 'Question placed before long data',
    sources: [S.anthropicLongContext, S.geminiStrategies, S.lostInMiddle, S.microsoftPromptEng],
    evaluate: ({ features, tokens }) => {
      if (tokens < 500) return null;
      const pos = lastInstructionPosition(features.text);
      if (pos === null || pos >= 0.35) return null;
      return {
        penalty: 0.5,
        message:
          'The ask comes before a long block of material. Models answer long prompts best when the question comes last.',
        suggestion:
          'Put documents/data first and move your question or instruction to the very end (up to 30% better on long inputs).',
      };
    },
  },
  {
    id: 'structure.wall-of-text',
    dimension: 'structure',
    title: 'Wall of text',
    sources: [S.microsoftPromptEng, S.anthropicClear],
    evaluate: ({ features, tokens }) =>
      tokens >= 200 && features.paragraphs <= 1 && features.listItems === 0
        ? {
            penalty: 0.3,
            message: 'The whole prompt is a single block of text.',
            suggestion: 'Break it into short paragraphs or a numbered list of steps/requirements.',
          }
        : null,
  },
];
