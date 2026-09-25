export interface TutorialStep {
  /** Matches a `data-tour` attribute in the app; omitted for a centered intro/outro card. */
  target?: string;
  title: string;
  body: string;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: 'Welcome to PromptGenius',
    body: 'PromptGenius helps you write better prompts for Claude, ChatGPT and Gemini. As you type, it estimates tokens, context and cost, and scores your prompt with suggestions to improve it. This quick tour shows what each part does.',
  },
  {
    target: 'mode',
    title: 'Simple or Advanced',
    body: 'Simple shows usage in plain terms for chat-app users. Advanced adds dollar costs, model and effort choices, a score breakdown and a multi-turn cost chart for API users. Switch any time.',
  },
  {
    target: 'target',
    title: 'Pick the platform and use case',
    body: 'Choose where you’ll send the prompt (Claude, ChatGPT or Gemini) and what it’s for, such as writing, coding or summarizing. Token counts, prices and the score follow each platform’s own rules and guidance.',
  },
  {
    target: 'prompt',
    title: 'Write or paste your prompt',
    body: 'Type the prompt here. Everything updates as you type. Your prompt stays in your browser: it isn’t stored or logged.',
  },
  {
    target: 'attachments',
    title: 'Attach files for context',
    body: 'Add PDFs, Word files, images or text that the prompt should use. You’ll see how many tokens each adds. Files only raise the score when your prompt says what to do with them. They’re read in your browser and never uploaded.',
  },
  {
    target: 'conversation',
    title: 'Say how far into the chat you are',
    body: 'Every message resends the whole conversation, so a long chat makes each new message cost more. Pick how much has been said already to get a realistic estimate.',
  },
  {
    target: 'score',
    title: 'Your prompt score',
    body: 'A score out of 100 for clarity, context, output format and efficiency. Red means weak, yellow needs work, green is good. Each suggestion shows how many points it’s worth and links to the vendor guidance behind it.',
  },
  {
    target: 'usage',
    title: 'Tokens, context and cost',
    body: 'See how many tokens the prompt and files use, how long the answer is likely to be, and how much of the context window it fills. In Advanced mode you’ll also see the cost per call.',
  },
  {
    target: 'rewrite',
    title: 'Optional AI rewrite (paid)',
    body: 'Want Claude to rewrite the prompt for your platform? This is the only paid feature. The button always shows the price first and asks you to confirm. Everything else is free.',
  },
  {
    title: 'You’re all set',
    body: 'Start typing a prompt to see it scored. You can replay this tour any time from the link at the bottom of the page.',
  },
];
