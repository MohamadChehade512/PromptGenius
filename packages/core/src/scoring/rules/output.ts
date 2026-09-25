import { BRIEF_WORD, detectExplicitLength } from '../../estimation/output';
import { S } from '../sources';
import type { Rule } from '../types';
import { fileUse, hasMaterial, isReviewTask } from './helpers';

const FORMAT_RE =
  /\b(?:json|table|list|bullets?|bullet points|markdown|csv|yaml|xml|paragraphs?|headings?|headers?|code block|numbered|outline|format(?:ted)?|schema|template|essay|email|tweet|thread|post|report|script|function|class|component|module|step[- ]by[- ]step|steps|sentences?|columns?|fields?|diff|snippet|slides?|memo|letter|summary|haiku|poem)\b/;
/** "brief" as a noun ("the assignment brief") and "page numbers" are not length limits. */
const LENGTH_WORDS_RE = new RegExp(
  `\\b(?:${BRIEF_WORD}|short|concise(?:ly)?|succinct(?:ly)?|tl;?dr|detailed|comprehensive|in[- ]depth|long|one[- ]pager|(?:one|a|single|half a)[- ]page)\\b`,
);
const CRITERIA_RE =
  /\b(?:should|must|needs? to|requirements?|criteria|constraints?|expected|ensure|make sure|tests?|edge cases?|handle|accuracy|accurate|return|only|without|avoid|limit|keep)\b/;
/** What a review is measured against: a target, criteria, or aspects to focus on. */
const REVIEW_FOCUS_RE =
  /\b(?:for (?:a|an|the|my|our) |against|focus(?:ing)? on|in terms of|criteria|rubric|standards?|looking for|compared (?:to|with)|ats|applicant tracking|tone|clarity|grammar|spelling|punctuation|structure|impact|readability|concise(?:ness)?|accuracy|bugs?|performance|security|style|formatting|keywords?|consistency|flow|persuasive(?:ness)?|role|job|position|priorit|most important|biggest|highest[- ]impact|weakness(?:es)?|strengths?)\b/;
const FALLBACK_RE =
  /\b(?:not found|n\/a|null|none|unknown|say so|if (?:it'?s |the answer is |the information is |they'?re )?(?:not|missing|absent|unclear|unsure)|if you (?:can'?t|cannot|don'?t know)|don'?t know|only (?:use|from|based on)|based only on)\b/;
const UNBOUNDED_RE =
  /\b(?:everything|all you know|as much as (?:possible|you can)|as detailed as possible|in as much detail|exhaustive(?:ly)?|leave nothing out|every single|all (?:the|of the) details)\b/;

export const outputRules: Rule[] = [
  {
    id: 'output.no-format',
    dimension: 'output',
    title: 'No output format',
    sources: [S.anthropicFormat, S.vertexComponents, S.microsoftPromptEng, S.openaiBestPractices],
    evaluate: ({ features, useCase }) =>
      FORMAT_RE.test(features.instructionLower)
        ? null
        : {
            // A review isn't a quick question, even under Q&A: its shape matters.
            penalty:
              useCase === 'brainstorming'
                ? 0.2
                : useCase === 'qa' && !isReviewTask(features)
                  ? 0.3
                  : 0.45,
            message: "The prompt doesn't say what shape the answer should take.",
            suggestion:
              useCase === 'extraction'
                ? 'Specify the exact structure, e.g. "Return JSON with fields name, email, company".'
                : 'Name the format, e.g. "a Markdown table with columns X, Y, Z" or "3 short paragraphs".',
          },
  },
  {
    id: 'output.no-length',
    dimension: 'output',
    title: 'No length limit',
    sources: [S.openaiBestPractices, S.dairTips, S.anthropicPricing],
    evaluate: ({ features, useCase }) => {
      // Extraction output length follows its input, so a limit isn't needed.
      if (useCase === 'extraction') return null;
      const unbounded = UNBOUNDED_RE.test(features.instructionLower);
      if (
        !unbounded &&
        (detectExplicitLength(features.instructionLower) ||
          LENGTH_WORDS_RE.test(features.instructionLower))
      ) {
        return null;
      }
      return {
        penalty:
          useCase === 'coding' ? 0.15 : useCase === 'qa' && !isReviewTask(features) ? 0.25 : 0.4,
        message:
          'No length or scope limit. Output costs 5–6× more than input, so answers tend to run long.',
        suggestion:
          'Bound the answer, e.g. "in under 150 words", "5 bullet points", or "one paragraph".',
      };
    },
  },
  {
    id: 'output.no-criteria',
    dimension: 'output',
    title: 'No success criteria',
    sources: [S.principled, S.vertexComponents, S.anthropicClear],
    useCases: ['coding', 'analysis', 'extraction'],
    evaluate: ({ features }) =>
      CRITERIA_RE.test(features.instructionLower)
        ? null
        : {
            penalty: 0.3,
            message: 'No requirements or constraints say what a correct answer must satisfy.',
            suggestion:
              'List the must-haves, e.g. "must handle empty input", "only use the standard library", "cite the source line".',
          },
  },
  {
    id: 'output.no-review-focus',
    dimension: 'output',
    title: 'No review focus',
    sources: [S.openaiBestPractices, S.vertexComponents, S.principled],
    evaluate: ({ features }) =>
      isReviewTask(features) && !REVIEW_FOCUS_RE.test(features.instructionLower)
        ? {
            penalty: 0.45,
            message:
              'The prompt asks for a review but gives no yardstick, so the feedback will be generic.',
            suggestion:
              'Say what to judge it against and what matters most, e.g. "for a junior analyst role; focus on measurable impact and ATS keywords".',
          }
        : null,
  },
  {
    id: 'output.no-fallback',
    dimension: 'output',
    title: 'No "out" when the answer may be missing',
    sources: [S.microsoftPromptEng],
    useCases: ['qa', 'analysis', 'extraction'],
    evaluate: (ctx) =>
      (hasMaterial(ctx.features) || fileUse(ctx).substantive) &&
      !FALLBACK_RE.test(ctx.features.instructionLower)
        ? {
            penalty: 0.2,
            message:
              "When answering from provided text or files, the model isn't told what to do if the answer isn't there, which invites made-up answers.",
            suggestion:
              'Add an out, e.g. "If the answer isn\'t in the text, reply \'not found\'" or "use null for missing fields".',
          }
        : null,
  },
];

export { UNBOUNDED_RE };
