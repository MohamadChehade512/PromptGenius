import type { Rule } from '../types';
import { attachmentRules } from './attachments';
import { clarityRules } from './clarity';
import { contextRules } from './context';
import { economyRules } from './economy';
import { exampleRules } from './examples';
import { outputRules } from './output';
import { claudeRules, geminiRules, openaiRules } from './platform';
import { structureRules } from './structure';

/** The rule registry. Add a rule by appending it to its dimension's list. */
export const ALL_RULES: readonly Rule[] = [
  ...clarityRules,
  ...contextRules,
  ...outputRules,
  ...structureRules,
  ...exampleRules,
  ...economyRules,
  ...claudeRules,
  ...openaiRules,
  ...geminiRules,
  ...attachmentRules,
];
