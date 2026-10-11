import { S } from '../sources';
import type { Rule } from '../types';
import {
  concreteDetails,
  fileUse,
  hasMaterial,
  isProductionTask,
  isReviewTask,
  materialReference,
  subjectWords,
} from './helpers';

const PURPOSE_RE =
  /\b(?:because|due to|so that|so i can|so we can|in order to|the goal|my goal|our goal|purpose|objective|i'?m (?:working|building|writing|trying|preparing|creating|planning|studying|learning|applying|running)|we'?re (?:working|building|launching|planning)|i am|we are|this (?:is|will be) (?:for|used)|to be used|for (?:my|our) (?!thing\b|stuff\b)[a-z]+|context:|background:|use case|(?:is|are|am) (?:preparing|building|working on|writing|planning|launching|creating|migrating|applying)|matters|is important|will (?:read|use|see) (?:it|this)|goal is|so (?:the|that|it|we|i|they|you|nothing|fewer|more)|(?:applying|preparing|studying) (?:to|for)|i'?m (?:a|an) [a-z-]+|i'?m [a-z]+ing|we'?re [a-z]+ing|for (?:a|an|the|my|our) (?:[\w-]+\s+){0,4}(?:role|job|position|application|internship|interview|program|programme|scholarship|class|course|client|clients|team|company|posting|opening|promotion|grant|conference|journal|launch|campaign)s?|apply(?:ing)? (?:to|for)|(?:to|so i can|so we can|in order to) (?:get|land|win|pass|apply|impress|convince))\b/;
const PROBLEM_RE =
  /\b(?:but|however|currently|right now|keeps|sometimes|fails?|failing|errors?|bug|issue|problem|broken|instead of|crash(?:es)?|slow|leaks?|leaking|stuck|hangs?|timeouts?|times out|runs? out of|deadlocks?|race condition|flaky|throws?|exception|unexpected|incorrect|wrong)\b/;
/** First-person situation: "I'm 34, rent in Toronto…", "we mostly use email…". Background is context. */
const SITUATION_RE =
  /\b(?:i'?m \d+|i am \d+|i'?m (?:the|a|an|my|our|his|her|their) [\w-]+|i am (?:the|a|an|my|our) [\w-]+|(?:i|we) (?:have|had|plan|use|run|own|work|live|rent|earn|make|manage|teach|study|mostly|currently|already|just)|our \d+[- ](?:person|people|member|employee)|my (?:doctor|boss|manager|teacher|client|landlord|team))\b/;
const AUDIENCE_RE =
  /\b(?:audience|readers?|for (?:beginners|experts|students|kids|children|executives|developers|engineers|customers|clients|investors|recruiters|managers|parents|teachers|non-technical|technical)|my (?:team|boss|manager|class|students|clients|customers|followers)|non-technical|technical|beginners?|experts?|stakeholders?|tone|voice|formal|casual|professional|friendly|vibe|feel|brand|advising|guests|crowd|attendees|colleagues|coworkers|co-workers|families|seniors|parents|neighbou?rs|subscribers|donors|volunteers|fans|shoppers|patients|recruiters?|hiring managers?|employers?|applicant tracking(?: systems?)?|ats|admissions(?: officers?| committees?)?|interviewers?|reviewers?|examiners?|graders?|(?:for|to) (?:(?:my|our|the|a|an|all) )?(?:[\w-]+\s+){0,3}(?:team|board|class|students|clients|customers|investors|executives|leadership|managers?|colleagues|audience|readers|users|community|followers|members|staff|department|committee|panel))\b/;
/** Something is wrong with "my app / our API / my code". */
const DEBUG_RE =
  /\b(?:slow|laggy|(?:doesn'?t|does not|isn'?t|is not|won'?t|not) (?:work|working|load|loading|run|running|compile|compiling|start)|broken|crash(?:es|ing|ed)?|errors?|bugs?|buggy|fails?|failing|hangs?|freez(?:es|ing)|leaks?|leaking|stuck|throws?|exceptions?)\b/;
const OWN_THING_RE =
  /\b(?:my|our)\s+(?:[\w.+#-]+\s+){0,3}?(?:app|apps|application|code|site|website|program|script|function|query|build|server|service|api|component|page|project|tests?|pipeline|deploy(?:ment)?|container|database|db|model|notebook|game|bot|extension|plugin|backend|frontend)\b/;
const QUOTED_ERROR_RE = /["“`][^"”`\n]{8,}["”`]|\b(?:error|exception|traceback)\b\s*[:(]/i;
/** A specific person the piece is for or about. */
const RELATION_RE =
  /\b(?:my|our) (?:grand(?:mother|father|ma|pa|parents?)|mother|mom|mum|father|dad|parents?|brother|sister|siblings?|son|daughter|kids?|children|wife|husband|partner|fianc[eé]e?|friend|best friend|uncle|aunt|cousin|niece|nephew|boss|manager|colleague|coworker|teacher|mentor|coach|neighbou?r|dog|cat)\b/;
/** Conceptual questions ("what is…", "difference between…") that don't depend on a stack. */
function isConceptQuestion(features: { instructionLower: string }): boolean {
  const l = features.instructionLower.trim();
  return (
    /^(?:what(?:'s| is| are)|how does|how do|why (?:is|are|do|does)|explain|when should)\b/.test(
      l,
    ) &&
    !/\b(?:my|our|this|these)\b/.test(l) &&
    !/\b(?:write|build|create|implement|fix|debug|code)\b/.test(l)
  );
}
/** Writing that only works with the author's own facts. */
const PERSONAL_PIECE_RE =
  /\b(?:cover letter|resume|cv|bio|biography|speech|toast|eulogy|vows|thank[- ]you (?:note|letter|email|card)|apology|letter of recommendation|recommendation letter|personal statement|wedding|birthday|retirement|condolence|obituary|about (?:me|us|my (?:company|business|startup|shop)))\b/;
const AUDIENCE_USE_CASES = new Set(['writing', 'analysis', 'summarization', 'brainstorming']);
const CODE_FILE_RE =
  /\.(?:py|ipynb|js|mjs|cjs|ts|tsx|jsx|java|kt|kts|scala|c|h|cpp|hpp|cc|cs|go|rb|php|rs|swift|sql|sh|r|dart|lua|vue|svelte)$/i;
const STACK_RE =
  /\b(?:python|javascript|typescript|java|kotlin|swift|go(?:lang)?|rust|c\+\+|c#|\.net|ruby|php|scala|sql|postgres(?:ql)?|mysql|sqlite|mongodb|bash|shell|powershell|html|css|react|vue|angular|svelte|next\.?js|node(?:\.js)?|django|flask|fastapi|rails|spring|laravel|pandas|numpy|tensorflow|pytorch|aws|terraform|docker|kubernetes|excel|vba|r)\b/;

export const contextRules: Rule[] = [
  {
    id: 'context.no-purpose',
    dimension: 'context',
    title: 'No purpose or background',
    sources: [S.anthropicContext, S.vertexComponents, S.openaiBestPractices],
    evaluate: ({ features, useCase }) => {
      if (
        PURPOSE_RE.test(features.instructionLower) ||
        SITUATION_RE.test(features.instructionLower) ||
        (useCase === 'coding' && PROBLEM_RE.test(features.instructionLower))
      )
        return null;
      // "Review my resume": improving something only makes sense against a goal.
      if (isReviewTask(features)) {
        return {
          penalty: 0.55,
          message: `The prompt asks to review or improve ${materialReference(features) ?? 'something'} but not what it's for, so "better" is undefined.`,
          suggestion:
            'Say the goal, e.g. "for an entry-level data analyst role at a fintech startup" or "for a scholarship application due Friday".',
        };
      }
      return {
        penalty: useCase === 'qa' && !isProductionTask(features) ? 0.35 : 0.45,
        message: "The prompt doesn't say why you need this or what it's for.",
        suggestion:
          useCase === 'coding'
            ? 'Add one sentence of context, e.g. "It\'s for a beginner Java course, so keep it readable" or "It runs in production on Java 21". Models make better trade-offs when they know the goal.'
            : 'Add one sentence of context, e.g. "This is for a README aimed at new contributors, so…". Models generalize better when they know the goal.',
      };
    },
  },
  {
    id: 'context.no-audience',
    dimension: 'context',
    title: 'No audience or tone',
    sources: [S.vertexComponents, S.principled, S.openaiBestPractices],
    evaluate: ({ features, useCase }) =>
      AUDIENCE_RE.test(features.instructionLower) ||
      // Quick questions, code and extraction rarely need one; a review of your work does.
      (!AUDIENCE_USE_CASES.has(useCase) && !isReviewTask(features))
        ? null
        : {
            penalty: 0.35,
            message: 'No audience or tone is specified.',
            suggestion:
              'Say who will read it and how it should sound, e.g. "for non-technical managers, in a friendly tone".',
          },
  },
  {
    id: 'context.no-details',
    dimension: 'context',
    title: 'No concrete details',
    sources: [S.openaiBestPractices, S.microsoftPromptEng, S.vertexComponents],
    evaluate: (ctx) => {
      const { features, useCase } = ctx;
      // A general question needs no specifics; a request to produce something does.
      if (useCase === 'qa' && !isProductionTask(features)) return null;
      if (hasMaterial(features) || concreteDetails(features).length > 0) return null;
      // A file the prompt points at carries the specifics.
      if (fileUse(ctx).substantive) return null;
      const subject = subjectWords(features).length;
      const personal = PERSONAL_PIECE_RE.exec(features.instructionLower);
      if (subject >= 6 && !personal) return null;
      if (personal) {
        // A cover letter or a toast is made of facts only you know. Naming who it's for
        // ("my grandmother", "my brother Sam") is a start, not the whole story.
        const named = RELATION_RE.test(features.instructionLower);
        return {
          penalty: named ? 0.4 : 0.7,
          message: `A ${personal[0]} depends on facts only you know (names, roles, stories, dates), and the prompt gives none.`,
          suggestion:
            'Add the specifics: who it is for and about, 2–3 real details or stories to include, and the occasion or role.',
          evidence: [personal[0]],
        };
      }
      return {
        penalty: subject <= 2 ? 0.45 : 0.25,
        message:
          "No names, numbers, examples or specifics: nothing the model couldn't have guessed on its own.",
        suggestion:
          'Add the facts only you know: names, numbers, dates, the product or topic, key points to include, or constraints.',
      };
    },
  },
  {
    id: 'context.coding-stack',
    dimension: 'context',
    title: 'No language or stack',
    sources: [S.googleWhitepaper, S.openaiBestPractices],
    useCases: ['coding'],
    evaluate: ({ features, attachments }) =>
      STACK_RE.test(features.lower) ||
      features.codeBlocks > 0 ||
      // An attached source file shows its language and libraries.
      attachments.some((a) => CODE_FILE_RE.test(a.name)) ||
      // "What's the difference between a process and a thread?" is language-agnostic.
      isConceptQuestion(features)
        ? null
        : {
            penalty: 0.45,
            message: 'No programming language, framework or version is mentioned.',
            suggestion:
              'Name the language, framework and versions (e.g. "TypeScript 6, React 19, Node 24") and any constraints.',
          },
  },
  {
    id: 'context.missing-material',
    dimension: 'context',
    title: 'Source material missing',
    sources: [S.microsoftPromptEng, S.anthropicLongContext],
    evaluate: ({ features, historyTokens, attachments, useCase }) => {
      if (hasMaterial(features) || historyTokens > 0 || attachments.length > 0) return null;
      const ref = materialReference(features);
      // Summaries and extraction always need a source; any use case does when the prompt
      // asks to review or improve "my resume" and the resume isn't there.
      const needsSource = useCase === 'summarization' || useCase === 'extraction';
      if (!needsSource && !(ref && isReviewTask(features))) return null;
      return {
        penalty: 0.8,
        message: ref
          ? `The prompt asks about ${ref}, but it isn't attached or pasted, so the model has nothing to work on.`
          : "There's no text to work on in the prompt.",
        suggestion:
          'Attach the file, or paste the source text wrapped in tags like <document>…</document> before your instruction.',
      };
    },
  },
  {
    id: 'context.no-repro',
    dimension: 'context',
    title: 'Nothing to diagnose',
    sources: [S.openaiBestPractices, S.googleWhitepaper, S.microsoftPromptEng],
    useCases: ['coding', 'qa'],
    evaluate: ({ features, attachments, historyTokens }) => {
      const lower = features.instructionLower;
      const thing = OWN_THING_RE.exec(lower);
      if (!thing || !DEBUG_RE.test(lower)) return null;
      if (hasMaterial(features) || attachments.length > 0 || historyTokens > 0) return null;
      // A detailed write-up (versions, numbers, what was tried) is a repro in words.
      if (features.instructionWords.length >= 40 && concreteDetails(features).length >= 3)
        return null;
      const quotedError = QUOTED_ERROR_RE.test(features.instructionText);
      return {
        penalty: quotedError ? 0.3 : 0.7,
        message: quotedError
          ? `There's an error message, but not the code that triggers it or what you expected ${thing[0]} to do.`
          : `The prompt says something is wrong with ${thing[0]} but includes no code, error message or symptoms to go on.`,
        suggestion:
          'Paste the smallest code that shows the problem, the exact error or measurement, what you expected, and the versions you use.',
        evidence: [thing[0]],
      };
    },
  },
];
