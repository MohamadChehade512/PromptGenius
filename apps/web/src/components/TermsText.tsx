import { TERMS_VERSION } from '../lib/agreement';

/**
 * Terms of Use. Written to match what the app actually does (PLAN.md §3.5–3.6). This is a
 * plain-language draft: have it reviewed before the site is public (PLAN.md §3.7).
 */
export function TermsText() {
  return (
    <>
      <p className="muted">Last updated {TERMS_VERSION}</p>

      <h3>1. What PromptGenius does</h3>
      <p>
        PromptGenius estimates how many tokens, how much context and roughly what cost a prompt uses
        on Claude, ChatGPT and Gemini, and scores it against those vendors' published prompting
        guidance. Estimates and scores are guidance, not bills or guarantees: vendors change their
        prices, limits and models often, and your actual usage may differ.
      </p>

      <h3>2. Free and paid features</h3>
      <p>
        Everything is free except the optional <strong>AI rewrite</strong>, which calls the Claude
        API. The rewrite button always shows its estimated price, asks you to confirm before its
        first use, and never runs on its own. A daily spending cap applies to all users.
      </p>

      <h3>3. Your prompts and files</h3>
      <p>
        Prompts and attached files are processed in your browser. They are not stored or logged. If
        you use the AI rewrite, your prompt, the names (not contents) of attached files, and the
        detected issues are sent to Anthropic's API to produce the rewrite, under{' '}
        <a href="https://www.anthropic.com/legal/commercial-terms" target="_blank" rel="noreferrer">
          Anthropic's terms
        </a>
        . Exact token counts, when available, send your prompt to Anthropic or Google for counting
        only.
      </p>

      <h3>4. Your name and email</h3>
      <p>
        We ask for your name and email to record that you agreed to these terms. They are saved only
        in this browser and are not sent to our server or shared with anyone. You can withdraw at
        any time from the link at the bottom of the page, which deletes them from this browser.
      </p>

      <h3>5. Acceptable use</h3>
      <p>
        Don't use PromptGenius to create unlawful or harmful content, to get around the rewrite
        limits, to overload the service, or to scrape it automatically. We may restrict access that
        breaks these rules.
      </p>

      <h3>6. No warranty</h3>
      <p>
        PromptGenius is provided "as is", without warranties of any kind. To the extent the law
        allows, we aren't liable for decisions or costs based on its estimates, scores or rewrites.
      </p>

      <h3>7. Changes</h3>
      <p>
        If these terms change, you'll be asked to read and agree to the new version before
        continuing.
      </p>
    </>
  );
}
