import { useDocumentTitle } from '../lib/router';

const SECTIONS = [
  { id: 'overview', title: 'Overview' },
  { id: 'efficiency', title: 'Why efficiency matters' },
  { id: 'workshop', title: 'The Workshop' },
  { id: 'scoring', title: 'How scoring works' },
  { id: 'suggestions', title: 'Suggestions and sources' },
  { id: 'estimates', title: 'Tokens, context and cost' },
  { id: 'files', title: 'Files' },
  { id: 'projects', title: 'Coding tools and projects' },
  { id: 'accuracy', title: 'How we test accuracy' },
  { id: 'privacy', title: 'Privacy' },
  { id: 'technology', title: 'Technology' },
  { id: 'studio', title: 'Prompt Studio' },
  { id: 'limits', title: 'Limits of the beta' },
] as const;

/**
 * How Prompt IQ works, for users. Explains the method clearly but deliberately leaves out the
 * scoring internals (weights, rule lists, thresholds per rule), which stay private.
 */
export function DocsPage() {
  useDocumentTitle('Docs · Prompt IQ');
  return (
    <main className="page docs">
      <header className="docs-head">
        <p className="eyebrow">Documentation</p>
        <h1 className="display">How Prompt IQ works</h1>
        <p className="lede">
          A plain-language guide to what Prompt IQ measures, where its advice comes from, how its
          estimates are made, and what happens to your data.
        </p>
      </header>

      <div className="docs-layout">
        <nav className="docs-toc" aria-label="On this page">
          <p className="toc-title">On this page</p>
          <ol>
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.title}</a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="prose">
          <section id="overview">
            <h2>Overview</h2>
            <p>
              The same request can produce a great answer or a useless one depending on how it’s
              asked. Prompt IQ checks a prompt before you send it, against what Anthropic, OpenAI
              and Google publish about getting good results from Claude, ChatGPT and Gemini. It then
              tells you what to fix and what the prompt will use in tokens, context window and cost.
            </p>
            <p>Prompt IQ has three parts:</p>
            <ul>
              <li>
                <strong>Docs</strong>: this guide.
              </li>
              <li>
                <strong>Prompt Workshop</strong>: the tool for scoring and refining a prompt as you
                type.
              </li>
              <li>
                <strong>Prompt Studio</strong>: speak a prompt and have it refined and scored as you
                talk.
              </li>
            </ul>
          </section>

          <section id="efficiency">
            <h2>Why efficiency matters</h2>
            <p>
              Most of what a message costs isn’t the prompt. It’s the answer and the hidden thinking
              the model does before answering, and both grow when the request is vague. A clear
              prompt can be longer than a vague one and still cost far less, because the answer is
              focused.
            </p>
            <p>
              The biggest cost is the retry. When an answer misses, you rephrase, and every
              follow-up resends the whole conversation so far. The Workshop shows the cost of a
              retry for your prompt, so you can see what getting it right the first time saves.
            </p>
          </section>

          <section id="workshop">
            <h2>The Workshop</h2>
            <p>The Workshop is laid out in the order you’d use it:</p>
            <ol>
              <li>
                <strong>Platform and use case.</strong> Choose Claude, ChatGPT or Gemini, and what
                the prompt is for: Q&amp;A, writing, coding, analysis, data extraction,
                brainstorming or summarization. The score and estimates follow that platform’s own
                guidance and pricing, and what a good prompt needs depends on the use case.
              </li>
              <li>
                <strong>Your prompt.</strong> Everything updates as you type. Copy the result
                straight into your chat when you’re done.
              </li>
              <li>
                <strong>Files, conversation and project access.</strong> Add files the prompt refers
                to, say how long the chat already is, and say whether the AI can already see your
                project.
              </li>
              <li>
                <strong>Score and usage.</strong> Read the score, the suggestions, and the token,
                context and cost estimates.
              </li>
            </ol>
            <p>
              <strong>Simple</strong> mode shows usage in plain terms for people using the chat
              apps. <strong>Advanced</strong> mode adds dollar costs, model and reasoning-effort
              choices, a per-area score breakdown and a multi-turn cost chart for API users.
            </p>
          </section>

          <section id="scoring">
            <h2>How scoring works</h2>
            <p>
              Each prompt gets a score out of 100, built from seven areas that the vendors’ guidance
              agrees matter:
            </p>
            <dl className="defs">
              <dt>Task clarity</dt>
              <dd>Is it clear what you want done, to what, and is the request complete?</dd>
              <dt>Context and intent</dt>
              <dd>
                Does the model know why you’re asking, who it’s for, and the material or details it
                needs?
              </dd>
              <dt>Output specification</dt>
              <dd>Does the prompt say what a good answer looks like: format, length, focus?</dd>
              <dt>Structure</dt>
              <dd>
                Is a longer prompt organised so instructions and material are easy to tell apart?
              </dd>
              <dt>Examples</dt>
              <dd>Where an example would help, is there one?</dd>
              <dt>Token economy</dt>
              <dd>Does every part earn its place, or is there filler and repetition?</dd>
              <dt>Platform fit</dt>
              <dd>Does it suit how the chosen platform and model work best?</dd>
            </dl>
            <p>
              How much each area counts depends on the use case. Examples matter more for data
              extraction than for brainstorming, for instance, and format matters more for
              extraction than for a quick question. Short, simple questions aren’t penalised for
              lacking the detail a long task needs.
            </p>
            <p>The score adapts to your situation:</p>
            <ul>
              <li>
                <strong>Follow-up messages</strong> are judged as part of a conversation, since the
                earlier messages already hold much of the context.
              </li>
              <li>
                <strong>Attached files</strong> count as context only when the prompt says what to
                do with them.
              </li>
              <li>
                <strong>Project access mode</strong> stops asking for material the AI can already
                see, and checks for what a coding agent needs instead.
              </li>
            </ul>
            <table className="docs-table">
              <caption>Score bands</caption>
              <thead>
                <tr>
                  <th scope="col">Score</th>
                  <th scope="col">Band</th>
                  <th scope="col">What it means</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>90–100</td>
                  <td>Excellent</td>
                  <td>Ready to send.</td>
                </tr>
                <tr>
                  <td>75–89</td>
                  <td>Good</td>
                  <td>Likely to work well; small gains left.</td>
                </tr>
                <tr>
                  <td>50–74</td>
                  <td>Needs work</td>
                  <td>Missing something that will cost you a retry.</td>
                </tr>
                <tr>
                  <td>0–49</td>
                  <td>Weak</td>
                  <td>The model will have to guess what you want.</td>
                </tr>
              </tbody>
            </table>
            <p className="note">
              The exact weights and checks behind the score are kept private, so the score stays a
              measure of good prompting rather than something to game.
            </p>
          </section>

          <section id="suggestions">
            <h2>Suggestions and sources</h2>
            <p>
              Every suggestion says what’s missing, how to fix it, and roughly how many points it’s
              worth, so you can fix the biggest gaps first. Simple mode shows the top three.
            </p>
            <p>
              Each suggestion links to the published guidance it comes from: Anthropic’s, OpenAI’s
              and Google’s prompting documentation, plus recognised prompt-engineering references.
              If a vendor recommends something different for its platform, the suggestions follow
              that vendor.
            </p>
          </section>

          <section id="estimates">
            <h2>Tokens, context and cost</h2>
            <ul>
              <li>
                <strong>Prompt tokens.</strong> ChatGPT counts are exact: OpenAI’s tokenizer runs in
                your browser. Claude and Gemini counts are close estimates, labelled “estimate”, and
                usually within about 10%.
              </li>
              <li>
                <strong>Expected answer.</strong> A likely range for the reply, based on the use
                case and any length you asked for.
              </li>
              <li>
                <strong>Thinking.</strong> For reasoning models, the hidden thinking the model does
                before answering, which is billed as output.
              </li>
              <li>
                <strong>Context window.</strong> Prompt, files, earlier conversation, answer and
                thinking, compared with the model’s or plan’s limit. Every message resends the whole
                conversation, so long chats fill up and cost more per message.
              </li>
              <li>
                <strong>Cost.</strong> API users see dollars from each vendor’s published prices.
                Chat apps don’t charge per message, so Simple mode compares your message with a
                typical one instead.
              </li>
            </ul>
            <p>
              Vendors change prices, limits and models often. Estimates are guidance, not bills.
            </p>
          </section>

          <section id="files">
            <h2>Files</h2>
            <p>
              You can attach PDFs, Word documents, images, and text or code files. They’re read in
              your browser and never uploaded. Prompt IQ works out how many tokens each file adds
              using each vendor’s published rules for documents and images. An image’s size, for
              example, decides its token cost.
            </p>
            <p>
              Files help the score only when the prompt uses them, as in “review the attached résumé
              for…”. A file the prompt never mentions, or one that doesn’t match the task, is
              flagged rather than rewarded.
            </p>
          </section>

          <section id="projects">
            <h2>Coding tools and projects</h2>
            <p>
              Tools like Claude Code, Cursor, GitHub Copilot and Codex, and Claude or ChatGPT
              Projects, can already see your files. Turn on <em>The AI can see my project</em> and
              Prompt IQ stops asking you to paste code. It checks instead that you’ve said where to
              look, what’s wrong or what should change, and how to check the result. This mode never
              gives a lower score than the same prompt without it.
            </p>
          </section>

          <section id="accuracy">
            <h2>How we test accuracy</h2>
            <p>
              Prompt IQ is tested against a library of real-world prompts across coding, writing and
              Q&amp;A, each graded by hand as weak, okay or strong. The score must agree with those
              grades and rank prompts in the same order. A separate set of prompts is never used for
              tuning, and checks how well the score handles prompts it hasn’t seen.
            </p>
            <p>
              These checks run automatically on every change, and an update isn’t published unless
              they pass.
            </p>
          </section>

          <section id="privacy">
            <h2>Privacy</h2>
            <ul>
              <li>
                Scoring and estimates run entirely in your browser. Your prompts and files aren’t
                sent to Prompt IQ, stored or logged.
              </li>
              <li>
                The name and email you give when agreeing to the terms are saved only in your
                browser, and you can delete them from the Workshop’s footer.
              </li>
              <li>
                The optional AI rewrite, when it launches, will send your prompt to Claude to
                rewrite it. It will always show the price and ask before running. File names are
                shared, never file contents.
              </li>
              <li>
                In Prompt Studio, your browser turns speech into text. Chrome and Edge send the
                audio to their own speech service to do that; Prompt IQ never receives or stores
                your audio or your words.
              </li>
            </ul>
          </section>

          <section id="technology">
            <h2>Technology</h2>
            <ul>
              <li>
                <strong>In your browser:</strong> a React and TypeScript app containing the scoring
                engine, the estimators, the file readers and OpenAI’s tokenizer. This is why it
                works without sending your prompt anywhere.
              </li>
              <li>
                <strong>Hosting:</strong> the site is delivered worldwide from Amazon CloudFront,
                which also checks Workshop access codes before anything is sent.
              </li>
              <li>
                <strong>Releases:</strong> each update is built and tested automatically, and goes
                live only if every check passes.
              </li>
              <li>
                <strong>Paid Claude features:</strong> there is no Prompt IQ server. With your own
                Anthropic API key, your browser calls Anthropic directly.
              </li>
            </ul>
          </section>

          <section id="studio">
            <h2>Prompt Studio</h2>
            <p>
              In Prompt Studio you speak instead of typing. Tap the microphone and say what you
              need, then copy the finished prompt into your chat.
            </p>
            <ol>
              <li>
                <strong>It listens.</strong> Your browser’s built-in speech recognition turns your
                voice into text (Chrome, Edge and Safari).
              </li>
              <li>
                <strong>It fixes slips.</strong> “Draft an email to Roger, um, I mean Michael”
                becomes “Draft an email to Michael.” Fillers, stutters and “scratch that” are
                handled too.
              </li>
              <li>
                <strong>It builds the prompt.</strong> Politeness padding is dropped, and context
                you say out loud (“the tone should be friendly”, “the purpose is…”, “keep it under
                100 words”) becomes a labeled line. Saying one again replaces it.
              </li>
              <li>
                <strong>It coaches and scores.</strong> Suggestions such as “Add a purpose” show
                what to say next, and the score rises as you add it.
              </li>
            </ol>
            <p>
              Studio works in two modes. The built-in mode uses rules: it’s free and instant, and
              nothing you say leaves your browser after transcription, but it only catches common
              phrasings. <strong>Refine with Claude</strong> is an optional, paid mode that sends
              the text of what you said to Claude each time you pause. It understands corrections
              and context said naturally (“he’s senior, so not too casual”), and can ask you one
              question when something important is missing. It costs a fraction of a cent per update
              and shows what it has spent.
            </p>
            <p>
              Both paid features (Refine with Claude here, and the AI rewrite in the Workshop) use{' '}
              <strong>your own Anthropic API key</strong>, so they are billed to your Anthropic
              account and Prompt IQ charges nothing. The key is checked with Anthropic, then kept
              only in your browser: for the current tab by default, or on the device if you ask. It
              is sent only to Anthropic, and “Forget key” removes it. We recommend a separate key
              with a spending limit set in the Anthropic Console.
            </p>
            <p className="note">Either way, check the prompt before sending it.</p>
          </section>

          <section id="limits">
            <h2>Limits of the beta</h2>
            <ul>
              <li>
                Scores and estimates may change as the method is refined, so the same prompt can
                score differently between versions.
              </li>
              <li>Claude and Gemini token counts are estimates.</li>
              <li>
                The AI rewrite and Refine with Claude need your own Anthropic API key. The daily
                spending guard is kept in your browser, so set a real limit on the key itself.
              </li>
              <li>Prompt Studio needs Chrome, Edge or Safari.</li>
            </ul>
          </section>
        </article>
      </div>
    </main>
  );
}
