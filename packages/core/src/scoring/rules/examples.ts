import { S } from '../sources';
import type { Rule } from '../types';

const EXAMPLE_RE =
  /\b(?:examples?|e\.g\.|for instance|such as|sample|like this)\b|<examples?>|^\s*(?:input|output|q|a)\s*:/im;
const STYLE_RE = /\b(?:tone|style|voice|like (?:this|my)|similar to|in the style of|match)\b/;

function countExamples(text: string): number {
  const tagged = text.match(/<example[\s>]/gi)?.length ?? 0;
  const labeled = text.match(/^\s*(?:#+\s*)?example\s*\d*\s*:/gim)?.length ?? 0;
  const io = text.match(/^\s*input\s*:/gim)?.length ?? 0;
  return Math.max(tagged, labeled, io);
}

export const exampleRules: Rule[] = [
  {
    id: 'examples.missing',
    dimension: 'examples',
    title: 'No examples',
    sources: [S.fewShot, S.geminiStrategies, S.anthropicExamples, S.microsoftPromptEng],
    evaluate: ({ features, useCase, platform }) => {
      if (EXAMPLE_RE.test(features.text)) return null;
      let penalty = 0;
      if (useCase === 'extraction') penalty = 0.65;
      else if (useCase === 'writing')
        penalty = STYLE_RE.test(features.instructionLower) ? 0.6 : 0.3;
      else if (useCase !== 'qa' && platform === 'gemini') penalty = 0.4;
      if (penalty === 0) return null;
      return {
        penalty,
        message:
          platform === 'gemini'
            ? 'No examples. Google notes that prompts without examples are likely to be less effective.'
            : 'No examples of the output you want.',
        suggestion:
          platform === 'claude'
            ? 'Add 3–5 short, varied examples wrapped in <example> tags.'
            : 'Add 2–3 consistently formatted input → output examples.',
      };
    },
  },
  {
    id: 'examples.too-few',
    dimension: 'examples',
    title: 'Only one example',
    sources: [S.anthropicExamples, S.geminiStrategies],
    useCases: ['extraction', 'writing'],
    evaluate: ({ features }) =>
      countExamples(features.text) === 1
        ? {
            penalty: 0.25,
            message: 'A single example can make the model copy it too closely.',
            suggestion: 'Use 3–5 diverse examples that cover edge cases.',
          }
        : null,
  },
];
