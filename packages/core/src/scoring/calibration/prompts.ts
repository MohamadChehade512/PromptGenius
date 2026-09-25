import type { AttachmentSource } from '../../attachments';
import type { PlatformId, UseCase } from '../../types';

export type Label = 'weak' | 'ok' | 'strong';

export interface LabeledPrompt {
  id: string;
  label: Label;
  platform: PlatformId;
  useCase: UseCase;
  prompt: string;
  /** Tokens already in the conversation (follow-up prompts). */
  historyTokens?: number;
  /** Files attached to the message (text as the browser would extract it). */
  attachments?: AttachmentSource[];
}

const REPORT = `Q3 revenue was $4.2M, up 12% quarter over quarter, driven mainly by enterprise renewals (68% of new bookings). Gross margin fell from 71% to 66% because of higher cloud hosting costs after the EU region launch. Churn in the SMB segment rose to 3.1% monthly, versus 2.4% in Q2, concentrated in customers on the legacy Starter plan. Headcount grew from 84 to 97, mostly in sales. Cash on hand is $11.8M, giving roughly 22 months of runway at the current burn rate. The board approved a pricing change that moves Starter customers to the new Team plan in Q1.`;

const EMAILS = `From: Priya Shah <priya@northwind.io>, Subject: Renewal, "We'd like to renew for 50 seats starting March 1."
From: Tom Becker <tom.b@acme.co>, Subject: Cancel, "Please cancel our trial, it isn't a fit right now."
From: Lena Ortiz <lena@globex.com>, Subject: Question, "Does the Team plan include SSO? We have 12 users."`;

const BRIEF = `HIST 110 Essay Assignment. Write an argumentative essay of 800 words on whether the printing press was the main cause of the Protestant Reformation. Audience: first-year history students and your seminar instructor. Your thesis must appear in the first paragraph. Use at least three pieces of evidence from the course readings (Eisenstein, Pettegree, and the Luther pamphlet collection) and address one counterargument. Rubric: thesis clarity 25%, use of evidence 35%, counterargument 20%, organization and prose 20%. Plain prose, no headings, Chicago-style footnotes.`;

const brief = (): AttachmentSource => ({
  id: 'brief',
  name: 'HIST110-essay-brief.pdf',
  kind: 'pdf',
  bytes: 48_000,
  pages: 1,
  text: BRIEF,
});

const board = (): AttachmentSource => ({
  id: 'board',
  name: 'Q3-board-report.pdf',
  kind: 'pdf',
  bytes: 1_400_000,
  pages: 12,
  text: Array.from({ length: 12 }, () => REPORT).join('\n\n'),
});

const RESUME = `Jordan Rivera, Toronto. EDUCATION: Bachelor of Commerce, Finance, University of Toronto, 2024, GPA 3.6. EXPERIENCE: Financial Analyst Intern, Maple Bank, May to August 2023. Built Excel models to forecast quarterly loan volumes and cut reporting time by 30%. Prepared weekly Power BI dashboards for the retail lending team. Sales Associate, Best Buy, 2021 to 2023: handled customer inquiries and trained four new hires. SKILLS: Excel, SQL, Power BI, Python (pandas), financial modeling. PROJECTS: stock screener in Python ranking TSX stocks by value metrics; Rotman Business Case Challenge finalist 2023.`;

const resume = (): AttachmentSource => ({
  id: 'resume',
  name: 'Jordan_Rivera_Resume.pdf',
  kind: 'pdf',
  bytes: 90_000,
  pages: 1,
  text: RESUME,
});

/**
 * Hand-labeled calibration set (PLAN.md §2.7, M6). Labels reflect the official vendor
 * guidance summarized in PLAN.md §1.5, judged per use case and platform:
 *  - weak:   missing the task, context or output spec; filler; or vague
 *  - ok:     a clear task, but missing context, format, or length
 *  - strong: clear task, purpose, audience/constraints, bounded output, well structured
 */
export const CALIBRATION_SET: LabeledPrompt[] = [
  // ---------- Q&A ----------
  {
    id: 'qa-weak-1',
    label: 'weak',
    platform: 'openai',
    useCase: 'qa',
    prompt: 'hey so i was wondering about stuff like taxes and things, can you help me out??',
  },
  { id: 'qa-weak-2', label: 'weak', platform: 'claude', useCase: 'qa', prompt: 'tell me about it' },
  {
    id: 'qa-ok-1',
    label: 'ok',
    platform: 'gemini',
    useCase: 'qa',
    prompt: 'How does compound interest work?',
  },
  {
    id: 'qa-ok-2',
    label: 'ok',
    platform: 'claude',
    useCase: 'qa',
    prompt: 'Can you please explain what a Roth IRA is and whether I should get one? Thanks!',
  },
  {
    id: 'qa-strong-1',
    label: 'strong',
    platform: 'openai',
    useCase: 'qa',
    prompt:
      'I am 28, earn $70k in Canada, and already max my employer RRSP match. In under 150 words, explain whether a TFSA or an extra RRSP contribution makes more sense for me, and name the one factor that would change the answer.',
  },
  {
    id: 'qa-strong-2',
    label: 'strong',
    platform: 'gemini',
    useCase: 'qa',
    prompt:
      "I'm studying for a networking exam next week. Explain the difference between TCP and UDP in 3 bullet points, then give one real-world example of when each is used.",
  },

  // ---------- Deliverable with no topic (the "write an essay" case) ----------
  {
    id: 'nt-weak-1',
    label: 'weak',
    platform: 'claude',
    useCase: 'writing',
    prompt: 'write an essay',
  },
  { id: 'nt-weak-2', label: 'weak', platform: 'openai', useCase: 'qa', prompt: 'write an essay' },
  {
    id: 'nt-weak-3',
    label: 'weak',
    platform: 'gemini',
    useCase: 'writing',
    prompt: 'Write a good poem.',
  },
  {
    id: 'nt-weak-4',
    label: 'weak',
    platform: 'openai',
    useCase: 'coding',
    prompt: 'Write some code for me please.',
  },
  {
    id: 'nt-ok-1',
    label: 'ok',
    platform: 'claude',
    useCase: 'writing',
    prompt: 'Write an essay about climate change.',
  },

  // ---------- Follow-ups in an ongoing chat ----------
  {
    id: 'fu-weak-1',
    label: 'weak',
    platform: 'claude',
    useCase: 'writing',
    prompt: 'make it shorter and more formal',
  },
  {
    id: 'fu-ok-1',
    label: 'ok',
    platform: 'claude',
    useCase: 'writing',
    prompt: 'make it shorter and more formal',
    historyTokens: 14_000,
  },
  {
    id: 'fu-strong-1',
    label: 'strong',
    platform: 'openai',
    useCase: 'writing',
    prompt:
      'Cut the second draft to 150 words for the investor newsletter, keep the Copenhagen example, and end with one question to readers.',
    historyTokens: 14_000,
  },

  // ---------- Writing ----------
  {
    id: 'wr-weak-1',
    label: 'weak',
    platform: 'claude',
    useCase: 'writing',
    prompt: 'help me with my essay',
  },
  {
    id: 'wr-weak-2',
    label: 'weak',
    platform: 'claude',
    useCase: 'writing',
    prompt: 'Could you please maybe write something nice about dogs? Thanks so much!!',
  },
  {
    id: 'wr-weak-3',
    label: 'weak',
    platform: 'gemini',
    useCase: 'writing',
    prompt:
      'IMPORTANT!!! write a REALLY good blog post, it is very important that it is AMAZING. you MUST make it good. please make sure it is good.',
  },
  {
    id: 'wr-ok-1',
    label: 'ok',
    platform: 'openai',
    useCase: 'writing',
    prompt: 'Write a LinkedIn post announcing that I got a new job as a data analyst at Shopify.',
  },
  {
    id: 'wr-ok-2',
    label: 'ok',
    platform: 'claude',
    useCase: 'writing',
    prompt:
      'Write a cover letter for a junior software developer position at a fintech startup. I know Python and React.',
  },
  {
    id: 'wr-strong-1',
    label: 'strong',
    platform: 'claude',
    useCase: 'writing',
    prompt: `<context>
I'm a final-year computer science student applying to a junior backend role at a fintech startup. The hiring manager values concise writing, so the letter is a first impression of how I communicate.
</context>

<instructions>
Write a cover letter in 3 short paragraphs (under 250 words total) in a confident but friendly tone. Mention my internship building payment reconciliation scripts in Python, and end with a one-sentence call to action.
</instructions>

<example>
Opening line style I like: "Reconciling 40,000 payments a night taught me that boring code is a feature."
</example>`,
  },
  {
    id: 'wr-strong-2',
    label: 'strong',
    platform: 'gemini',
    useCase: 'writing',
    prompt: `Write a product announcement email for our customers (small-business owners, non-technical).

Goal: explain that invoices can now be paid by bank transfer, so fewer customers email support about payment options.

Format: subject line, then 2 short paragraphs, then a bulleted list of 3 benefits. Keep it under 180 words, warm and plain-spoken.

Example subject line style: "Get paid faster: bank transfers are here"`,
  },

  // ---------- Coding ----------
  {
    id: 'co-weak-1',
    label: 'weak',
    platform: 'openai',
    useCase: 'coding',
    prompt: 'fix my code its not working',
  },
  {
    id: 'co-weak-2',
    label: 'weak',
    platform: 'claude',
    useCase: 'coding',
    prompt: 'make a website',
  },
  {
    id: 'co-ok-1',
    label: 'ok',
    platform: 'openai',
    useCase: 'coding',
    prompt: 'Write a function to check if a string is a palindrome in JavaScript.',
  },
  {
    id: 'co-ok-2',
    label: 'ok',
    platform: 'gemini',
    useCase: 'coding',
    prompt: 'How do I connect to a Postgres database from Node?',
  },
  {
    id: 'co-strong-1',
    label: 'strong',
    platform: 'openai',
    useCase: 'coding',
    prompt:
      'Write a Python function that parses ISO 8601 dates and returns a datetime. It must handle timezone offsets and raise ValueError on invalid input. Return only the code in a single code block with type hints and a docstring. This is for a CLI tool I am building.',
  },
  {
    id: 'co-strong-2',
    label: 'strong',
    platform: 'claude',
    useCase: 'coding',
    prompt: `<context>
TypeScript 6 + React 19 app. We debounce a search box, but typing fast sometimes shows results for an older query because responses arrive out of order.
</context>

<code>
useEffect(() => {
  const t = setTimeout(() => fetch('/api/search?q=' + q).then(r => r.json()).then(setResults), 300);
  return () => clearTimeout(t);
}, [q]);
</code>

<instructions>
Fix the race so only the latest query's results are shown. Keep the 300 ms debounce, use AbortController, and don't add dependencies. Return the corrected hook in one code block, followed by 2 sentences explaining the fix.
</instructions>`,
  },

  // ---------- Analysis ----------
  {
    id: 'an-weak-1',
    label: 'weak',
    platform: 'gemini',
    useCase: 'analysis',
    prompt: 'analyze the market',
  },
  {
    id: 'an-weak-2',
    label: 'weak',
    platform: 'openai',
    useCase: 'analysis',
    prompt:
      'Tell me everything you know about electric vehicles, as detailed as possible, leave nothing out.',
  },
  {
    id: 'an-ok-1',
    label: 'ok',
    platform: 'claude',
    useCase: 'analysis',
    prompt: 'What are the pros and cons of remote work for software companies?',
  },
  {
    id: 'an-ok-2',
    label: 'ok',
    platform: 'openai',
    useCase: 'analysis',
    prompt: 'Compare AWS Lambda and Google Cloud Run for hosting a small web API.',
  },
  {
    id: 'an-strong-1',
    label: 'strong',
    platform: 'openai',
    useCase: 'analysis',
    prompt: `## Role
You are a cloud architect advising a two-person startup.

## Context
We are launching a low-traffic REST API (about 50k requests/day, spiky) and want to minimize cost and ops work. The team knows TypeScript and has no Kubernetes experience.

## Task
Compare AWS Lambda and Google Cloud Run for this workload.

## Output
A Markdown table with rows for cost at our volume, cold starts, local development, and vendor lock-in, then a one-paragraph recommendation. Keep it under 300 words and state any assumption you make.`,
  },
  {
    id: 'an-strong-2',
    label: 'strong',
    platform: 'claude',
    useCase: 'analysis',
    prompt: `<document>
${REPORT}
</document>

We're preparing for a board meeting and need to know where the business is most at risk. Identify the 3 biggest risks in this quarterly report for non-technical board members. For each, give one sentence of evidence quoted from the report and one suggested question the board should ask. Format as a numbered list, under 200 words.`,
  },

  // ---------- Extraction ----------
  {
    id: 'ex-weak-1',
    label: 'weak',
    platform: 'claude',
    useCase: 'extraction',
    prompt: 'get the info out of this',
  },
  {
    id: 'ex-weak-2',
    label: 'weak',
    platform: 'gemini',
    useCase: 'extraction',
    prompt: 'Please could you kindly pull out the important stuff from the emails I have, thanks!',
  },
  {
    id: 'ex-ok-1',
    label: 'ok',
    platform: 'openai',
    useCase: 'extraction',
    prompt: `Extract the names and emails from these messages:\n\n${EMAILS}`,
  },
  {
    id: 'ex-strong-1',
    label: 'strong',
    platform: 'claude',
    useCase: 'extraction',
    prompt: `<emails>
${EMAILS}
</emails>

Extract one record per email for our CRM import. Return only a JSON array; each object must have the fields name, email, company (from the email domain), intent (one of "renewal", "cancel", "question") and seats (number or null). Only use values present in the text.

<examples>
<example>
Input: From: Sam Lee <sam@initech.com>, Subject: Upgrade, "We need 20 more seats."
Output: {"name": "Sam Lee", "email": "sam@initech.com", "company": "initech", "intent": "question", "seats": 20}
</example>
<example>
Input: From: Ana Ruiz <ana@umbrella.org>, Subject: Bye, "We're cancelling at the end of the month."
Output: {"name": "Ana Ruiz", "email": "ana@umbrella.org", "company": "umbrella", "intent": "cancel", "seats": null}
</example>
</examples>`,
  },
  {
    id: 'ex-strong-2',
    label: 'strong',
    platform: 'gemini',
    useCase: 'extraction',
    prompt: `Messages:
${EMAILS}

Example:
Input: From: Sam Lee <sam@initech.com>, "We need 20 more seats."
Output: Sam Lee | sam@initech.com | 20

Task: for our CRM import, extract each sender as a CSV with columns name, email, seats (empty if not mentioned). Return only the CSV with a header row.`,
  },

  // ---------- Brainstorming ----------
  {
    id: 'br-weak-1',
    label: 'weak',
    platform: 'openai',
    useCase: 'brainstorming',
    prompt: 'ideas?',
  },
  {
    id: 'br-weak-2',
    label: 'weak',
    platform: 'claude',
    useCase: 'brainstorming',
    prompt: 'I need some cool names for my thing, just give me whatever',
  },
  {
    id: 'br-ok-1',
    label: 'ok',
    platform: 'gemini',
    useCase: 'brainstorming',
    prompt: 'Give me names for a coffee shop.',
  },
  {
    id: 'br-ok-2',
    label: 'ok',
    platform: 'claude',
    useCase: 'brainstorming',
    prompt: 'Brainstorm some app ideas that use AI to help students study better.',
  },
  {
    id: 'br-strong-1',
    label: 'strong',
    platform: 'openai',
    useCase: 'brainstorming',
    prompt:
      "I'm opening a small specialty coffee shop near a university campus; the vibe is quiet, bookish and warm. Suggest 10 name ideas, each under 3 words, with a one-line reason for each. Avoid puns on 'bean' or 'brew' since nearby shops already use them.",
  },
  {
    id: 'br-strong-2',
    label: 'strong',
    platform: 'gemini',
    useCase: 'brainstorming',
    prompt: `Context: our team is building a study app for first-year university students who struggle with time management.

Task: brainstorm 8 feature ideas that use AI. For each, give the feature name and one sentence on the student problem it solves, as a numbered list.

Example: "Deadline radar: turns syllabus PDFs into a week-by-week plan so nothing sneaks up on you."`,
  },

  // ---------- Summarization ----------
  {
    id: 'su-weak-1',
    label: 'weak',
    platform: 'claude',
    useCase: 'summarization',
    prompt: 'summarize this',
  },
  {
    id: 'su-weak-2',
    label: 'weak',
    platform: 'openai',
    useCase: 'summarization',
    prompt: 'Can you please give me a summary of the article, thank you so much in advance!',
  },
  {
    id: 'su-ok-1',
    label: 'ok',
    platform: 'gemini',
    useCase: 'summarization',
    prompt: `Summarize this report:\n\n${REPORT}`,
  },
  {
    id: 'su-strong-1',
    label: 'strong',
    platform: 'claude',
    useCase: 'summarization',
    prompt: `<document>
${REPORT}
</document>

You are preparing a briefing for our CEO, who has two minutes before a board call. Summarize the report above in 5 bullet points for a non-technical reader, lead with the most important number, and keep the whole summary under 100 words.`,
  },
  {
    id: 'su-strong-2',
    label: 'strong',
    platform: 'openai',
    useCase: 'summarization',
    prompt: `## Report
${REPORT}

## Task
Summarize the report for our investor update newsletter (audience: non-technical angel investors). Return exactly 3 bullet points, each under 25 words, covering growth, margins, and runway.`,
  },

  // ---------- With attached files ----------
  {
    id: 'fi-weak-1',
    label: 'weak',
    platform: 'claude',
    useCase: 'writing',
    prompt: 'write an essay',
    attachments: [brief(), board()],
  },
  {
    id: 'fi-weak-2',
    label: 'weak',
    platform: 'openai',
    useCase: 'summarization',
    prompt: 'summarize',
    attachments: [brief(), board()],
  },
  {
    id: 'fi-ok-1',
    label: 'ok',
    platform: 'claude',
    useCase: 'summarization',
    prompt: 'Summarize this.',
    attachments: [board()],
  },
  {
    id: 'fi-ok-2',
    label: 'ok',
    platform: 'gemini',
    useCase: 'writing',
    prompt: 'Write the essay described in the attached assignment brief.',
    attachments: [brief()],
  },
  {
    id: 'fi-ok-3',
    label: 'ok',
    platform: 'openai',
    useCase: 'coding',
    prompt: "What's causing the error in this screenshot?",
    attachments: [
      { id: 'shot', name: 'error.png', kind: 'image', bytes: 310_000, width: 1920, height: 1080 },
    ],
  },
  {
    id: 'fi-ok-4',
    label: 'ok',
    platform: 'claude',
    useCase: 'analysis',
    prompt:
      'Using the attached file, explain the main causes of the French Revolution for my high-school class in 5 bullet points.',
    attachments: [board()],
  },
  {
    id: 'fi-strong-1',
    label: 'strong',
    platform: 'claude',
    useCase: 'writing',
    prompt:
      "Using the attached assignment brief, write the 800-word argumentative essay it describes for my first-year history seminar. Follow the rubric's structure: thesis in the first paragraph, three evidence-based arguments from the listed readings, then one counterargument. Plain prose, no headings.",
    attachments: [brief()],
  },
  {
    id: 'fi-strong-2',
    label: 'strong',
    platform: 'gemini',
    useCase: 'analysis',
    prompt:
      'From the attached Q3 board report, quote the passages about gross margin and churn (with page numbers). Then, for our finance team, explain in 5 bullets under 25 words each what drove each change and which risk matters most for Q1.',
    attachments: [board()],
  },
  // ---------- Resume review (from user testing, 2026-09-24) ----------
  {
    id: 'rv-weak-1',
    label: 'weak',
    platform: 'claude',
    useCase: 'qa',
    prompt: 'Review my resume and tell me what to improve.',
    attachments: [resume()],
  },
  {
    id: 'rv-weak-2',
    label: 'weak',
    platform: 'claude',
    useCase: 'qa',
    prompt: 'Review my resume and tell me what to improve.',
  },
  {
    id: 'rv-weak-3',
    label: 'weak',
    platform: 'openai',
    useCase: 'writing',
    prompt: 'review my resume and',
    attachments: [resume()],
  },
  {
    id: 'rv-ok-1',
    label: 'ok',
    platform: 'gemini',
    useCase: 'qa',
    prompt:
      'Review my attached resume for an entry-level financial analyst role and suggest improvements.',
    attachments: [resume()],
  },
  {
    id: 'rv-strong-1',
    label: 'strong',
    platform: 'claude',
    useCase: 'qa',
    prompt:
      'Review the attached resume for an entry-level financial analyst role at a Canadian bank. List the 5 highest-impact changes as bullet points, each with a rewritten example line, and flag any keywords an applicant tracking system might miss.',
    attachments: [resume()],
  },
];
