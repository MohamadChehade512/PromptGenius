import { TERMS_VERSION } from '../lib/agreement';

/**
 * Terms of Use. Written to match what the app actually does (PLAN.md §3.5–3.6). This is a
 * plain-language draft: have it reviewed before the site is public (PLAN.md §3.7).
 */
export function TermsText() {
  return (
    <>
      <p className="muted">Last updated {TERMS_VERSION}</p>

      <h3>1. What Prompt IQ does</h3>
      <p>
        Prompt IQ estimates how many tokens, how much context and roughly what cost a prompt uses on
        Claude, ChatGPT and Gemini, and scores it against those vendors' published prompting
        guidance. Estimates and scores are guidance, not bills or guarantees: vendors change their
        prices, limits and models often, and your actual usage may differ.
      </p>

      <h3>2. Free and paid features</h3>
      <p>
        Everything is free except two optional features that call the Claude API: the Workshop’s{' '}
        <strong>AI rewrite</strong> and Prompt Studio’s <strong>Refine with Claude</strong>. To use
        them you add your own Anthropic API key, and they are billed to your Anthropic account at
        Anthropic’s prices; Prompt IQ charges nothing. Both are off until you turn them on, and both
        show their price first. The rewrite asks you to confirm before its first use and never runs
        on its own. Refine with Claude runs each time you pause while its switch is on, and shows
        what it has spent. Prompt IQ stops making paid calls after about $2 a day on each device,
        but this is a convenience, not a guarantee: set a spending limit on your key in the
        Anthropic Console.
      </p>
      <p>
        <strong>Your API key</strong> is kept only in this browser: until you close the tab, or on
        this device if you choose that, until you select “Forget key”. It is sent only to Anthropic,
        with each paid request. Prompt IQ never receives or stores it. Anyone who can use this
        browser profile could use a remembered key, so don’t add one on a shared computer, and you
        are responsible for charges made with it.
      </p>

      <h3>3. Your prompts and files</h3>
      <p>
        Prompts and attached files are processed in your browser. They are not stored or logged. If
        you use the AI rewrite, your prompt, the names (not contents) of attached files, and the
        detected issues are sent from your browser straight to Anthropic's API to produce the
        rewrite, under{' '}
        <a href="https://www.anthropic.com/legal/commercial-terms" target="_blank" rel="noreferrer">
          Anthropic's terms
        </a>
        . Exact token counts, when available, send your prompt to Anthropic or Google for counting
        only.
      </p>

      <p>
        In <strong>Prompt Studio</strong>, speech is turned into text by your browser’s built-in
        speech recognition. Some browsers (including Chrome and Edge) send your audio to their own
        speech service to do this, under that browser’s terms. Prompt IQ never receives, stores or
        logs your audio or the resulting text. If you switch on Refine with Claude, the text of what
        you said is sent to Anthropic’s API to produce the prompt, under Anthropic’s terms; it isn’t
        stored by Prompt IQ.
      </p>

      <h3>4. Your name and email</h3>
      <p>
        We ask for your name and email to record that you agreed to these terms. They are saved only
        in this browser and are not sent to our server or shared with anyone. You can withdraw at
        any time from the link at the bottom of the page, which deletes them from this browser.
      </p>

      <h3>5. Acceptable use</h3>
      <p>
        Don't use Prompt IQ to create unlawful or harmful content, to get around the rewrite limits,
        to overload the service, or to scrape it automatically. We may restrict access that breaks
        these rules.
      </p>

      <h3>6. No warranty</h3>
      <p>
        Prompt IQ is provided "as is", without warranties of any kind. To the extent the law allows,
        we aren't liable for decisions or costs based on its estimates, scores or rewrites.
      </p>

      <h3>7. Changes</h3>
      <p>
        If these terms change, you'll be asked to read and agree to the new version before
        continuing.
      </p>
    </>
  );
}
