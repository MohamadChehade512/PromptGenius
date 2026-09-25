export type Publisher = 'Anthropic' | 'OpenAI' | 'Google' | 'Microsoft' | 'DAIR.AI' | 'Research';

export interface Source {
  publisher: Publisher;
  title: string;
  url: string;
}

const CLAUDE_BP =
  'https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices';

/**
 * Every rule cites the guidance it is based on (PLAN.md §1.5). Vendor docs come first;
 * peer-reviewed or widely cited research backs the general claims. Where sources disagree
 * (e.g. ALL-CAPS "You MUST"), PLAN.md §1.7 records which one the rule follows and why.
 */
export const S = {
  // Anthropic
  anthropicClear: {
    publisher: 'Anthropic',
    title: 'Be clear and direct',
    url: `${CLAUDE_BP}#be-clear-and-direct`,
  },
  anthropicContext: {
    publisher: 'Anthropic',
    title: 'Add context to improve performance',
    url: `${CLAUDE_BP}#add-context-to-improve-performance`,
  },
  anthropicExamples: {
    publisher: 'Anthropic',
    title: 'Use examples effectively',
    url: `${CLAUDE_BP}#use-examples-effectively`,
  },
  anthropicXml: {
    publisher: 'Anthropic',
    title: 'Structure prompts with XML tags',
    url: `${CLAUDE_BP}#structure-prompts-with-xml-tags`,
  },
  anthropicLongContext: {
    publisher: 'Anthropic',
    title: 'Long context prompting',
    url: `${CLAUDE_BP}#long-context-prompting`,
  },
  anthropicFormat: {
    publisher: 'Anthropic',
    title: 'Control the format of responses',
    url: `${CLAUDE_BP}#control-the-format-of-responses`,
  },
  anthropicEmphasis: {
    publisher: 'Anthropic',
    title: 'Tool usage: dial back aggressive language',
    url: `${CLAUDE_BP}#tool-usage`,
  },
  anthropicContextEng: {
    publisher: 'Anthropic',
    title: 'Effective context engineering for AI agents',
    url: 'https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents',
  },
  anthropicContextWindows: {
    publisher: 'Anthropic',
    title: 'Context windows',
    url: 'https://platform.claude.com/docs/en/build-with-claude/context-windows',
  },
  anthropicVision: {
    publisher: 'Anthropic',
    title: 'Vision: image limits and costs',
    url: 'https://platform.claude.com/docs/en/build-with-claude/vision',
  },
  anthropicPdf: {
    publisher: 'Anthropic',
    title: 'PDF support: estimate your costs',
    url: 'https://platform.claude.com/docs/en/build-with-claude/pdf-support',
  },
  anthropicPricing: {
    publisher: 'Anthropic',
    title: 'Pricing',
    url: 'https://platform.claude.com/docs/en/about-claude/pricing',
  },

  // OpenAI
  openaiPromptEng: {
    publisher: 'OpenAI',
    title: 'Prompt engineering guide',
    url: 'https://developers.openai.com/api/docs/guides/prompt-engineering',
  },
  openaiBestPractices: {
    publisher: 'OpenAI',
    title: 'Best practices for prompt engineering with the OpenAI API',
    url: 'https://help.openai.com/en/articles/6654000-best-practices-for-prompt-engineering-with-the-openai-api',
  },
  openaiGpt5: {
    publisher: 'OpenAI',
    title: 'GPT-5 prompting guide',
    url: 'https://developers.openai.com/cookbook/examples/gpt-5/gpt-5_prompting_guide',
  },
  openaiReasoning: {
    publisher: 'OpenAI',
    title: 'Reasoning models',
    url: 'https://developers.openai.com/api/docs/guides/reasoning',
  },
  openaiVision: {
    publisher: 'OpenAI',
    title: 'Images and vision: calculating costs',
    url: 'https://developers.openai.com/api/docs/guides/images-vision',
  },
  openaiFiles: {
    publisher: 'OpenAI',
    title: 'File inputs (PDFs)',
    url: 'https://developers.openai.com/api/docs/guides/pdf-files',
  },
  openaiPricing: {
    publisher: 'OpenAI',
    title: 'Pricing',
    url: 'https://developers.openai.com/api/docs/pricing',
  },

  // Google
  geminiStrategies: {
    publisher: 'Google',
    title: 'Gemini API: prompt design strategies',
    url: 'https://ai.google.dev/gemini-api/docs/prompting-strategies',
  },
  geminiDocuments: {
    publisher: 'Google',
    title: 'Gemini API: document understanding',
    url: 'https://ai.google.dev/gemini-api/docs/document-processing',
  },
  geminiMediaResolution: {
    publisher: 'Google',
    title: 'Gemini API: media resolution',
    url: 'https://ai.google.dev/gemini-api/docs/media-resolution',
  },
  vertexComponents: {
    publisher: 'Google',
    title: 'Vertex AI: introduction to prompting (prompt components)',
    url: 'https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/prompts/introduction-prompt-design',
  },
  googleWhitepaper: {
    publisher: 'Google',
    title: 'Prompt Engineering whitepaper (Boonstra, 2024)',
    url: 'https://www.kaggle.com/whitepaper-prompt-engineering',
  },

  // Microsoft
  microsoftPromptEng: {
    publisher: 'Microsoft',
    title: 'Prompt engineering techniques (Azure OpenAI)',
    url: 'https://learn.microsoft.com/en-us/azure/foundry/openai/concepts/prompt-engineering',
  },

  // Community
  dairTips: {
    publisher: 'DAIR.AI',
    title: 'Prompt Engineering Guide: general tips',
    url: 'https://www.promptingguide.ai/introduction/tips',
  },

  // Research
  fewShot: {
    publisher: 'Research',
    title: 'Brown et al. 2020, Language Models are Few-Shot Learners',
    url: 'https://arxiv.org/abs/2005.14165',
  },
  chainOfThought: {
    publisher: 'Research',
    title: 'Wei et al. 2022, Chain-of-Thought Prompting',
    url: 'https://arxiv.org/abs/2201.11903',
  },
  lostInMiddle: {
    publisher: 'Research',
    title: 'Liu et al. 2023, Lost in the Middle',
    url: 'https://arxiv.org/abs/2307.03172',
  },
  contextRot: {
    publisher: 'Research',
    title: 'Chroma 2025, Context Rot',
    url: 'https://www.trychroma.com/research/context-rot',
  },
  llmlingua: {
    publisher: 'Research',
    title: 'Jiang et al. 2023, LLMLingua (prompt compression)',
    url: 'https://arxiv.org/abs/2310.05736',
  },
  principled: {
    publisher: 'Research',
    title: 'Bsharat et al. 2023, 26 Principled Instructions',
    url: 'https://arxiv.org/abs/2312.16171',
  },
  politeness: {
    publisher: 'Research',
    title: 'Yin et al. 2024, Should We Respect LLMs? (politeness)',
    url: 'https://arxiv.org/abs/2402.14531',
  },
  formatSensitivity: {
    publisher: 'Research',
    title: 'Sclar et al. 2024, Sensitivity to prompt formatting',
    url: 'https://arxiv.org/abs/2310.11324',
  },
  promptReport: {
    publisher: 'Research',
    title: 'Schulhoff et al. 2024, The Prompt Report',
    url: 'https://arxiv.org/abs/2406.06608',
  },
} as const satisfies Record<string, Source>;
