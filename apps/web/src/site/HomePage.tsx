import { linkClick, useDocumentTitle } from '../lib/router';
import { HeroDemo } from './home/HeroDemo';
import { Reveal } from './home/parts';
import { ReadingSteps, RetryCost, TokenizerView } from './home/Sections';
import { StudioDemo } from './home/StudioDemo';

/** The front door: what Prompt IQ does (shown working), and the way into each of its parts. */
export function HomePage() {
  useDocumentTitle('Prompt IQ · Better answers for fewer tokens');
  return (
    <main className="home">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="dot" aria-hidden="true" /> Private beta
          </p>
          <h1 className="display">Better answers. Fewer tokens.</h1>
          <p className="lede">
            Prompt IQ checks your prompt before you send it to Claude, ChatGPT or Gemini. It shows
            what’s missing, what’s wasting tokens, and what the answer will cost, so you get it
            right the first time.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="/workshop">
              Open Prompt Workshop
            </a>
            <a className="button secondary" href="/studio">
              <span className="soon-tag">New</span> Speak it in Studio
            </a>
            <a className="hero-link" href="/docs" onClick={linkClick('/docs')}>
              How it works <span aria-hidden="true">→</span>
            </a>
          </div>
          <p className="hint">The Workshop and Studio need an access code during the beta.</p>
        </div>
        <HeroDemo />
      </section>

      <div className="home-sections">
        <ReadingSteps />

        <Reveal>
          <RetryCost />
        </Reveal>

        <Reveal>
          <TokenizerView />
        </Reveal>

        <Reveal as="section" className="studio-intro">
          <div className="studio-intro-copy">
            <p className="eyebrow">
              Prompt Studio <span className="soon-tag">New</span>
            </p>
            <h2 className="section-title">Say it. Studio writes the prompt.</h2>
            <p className="section-lede">
              Talk the way you normally would. Studio removes the slips and filler, builds a tight
              prompt while you speak, and tells you what to add to make it better.
            </p>
            <ol className="studio-points">
              <li>
                <strong>Fixes what you didn’t mean</strong>
                “Roger, I mean Michael” becomes Michael. Ums and repeats are dropped.
              </li>
              <li>
                <strong>Coaches while you talk</strong>
                Say a tone, a length or a purpose and watch the score rise.
              </li>
              <li>
                <strong>Shows what you save</strong>
                Prompt quality and tokens per answer, before and after.
              </li>
            </ol>
            <div className="hero-actions">
              <a className="button primary" href="/studio">
                Open Prompt Studio
              </a>
            </div>
            <p className="hint">Access code required. Works in Chrome, Edge and Safari.</p>
          </div>
          <StudioDemo />
        </Reveal>

        <Reveal as="section" className="products">
          <div className="section-head">
            <p className="eyebrow">Prompt IQ</p>
            <h2 className="section-title">Three ways in</h2>
          </div>
          <div className="product-grid">
            <article className="product">
              <h3>Docs</h3>
              <p>
                How prompts are scored, how token and cost estimates are made, and what happens to
                your data.
              </p>
              <a className="product-link" href="/docs" onClick={linkClick('/docs')}>
                Read the docs <span aria-hidden="true">→</span>
              </a>
            </article>

            <article className="product product-main">
              <h3>Prompt Workshop</h3>
              <p>
                Score and refine a prompt as you type, with files, project context, and tokens,
                context and cost for each platform.
              </p>
              <a className="product-link" href="/workshop">
                Open the Workshop <span aria-hidden="true">→</span>
              </a>
              <span className="product-note">Access code required</span>
            </article>

            <article className="product">
              <h3>
                Prompt Studio <span className="soon-tag">New</span>
              </h3>
              <p>
                Say what you need. Studio fixes spoken slips, builds a tight prompt as you talk, and
                tells you what to add to make it better.
              </p>
              <a className="product-link" href="/studio">
                Open Studio <span aria-hidden="true">→</span>
              </a>
              <span className="product-note">Access code required · Chrome, Edge or Safari</span>
            </article>
          </div>
        </Reveal>

        <Reveal as="section" className="cta">
          <h2 className="section-title">Stop paying for retries.</h2>
          <p className="section-lede">Check your next prompt before you send it.</p>
          <a className="button primary" href="/workshop">
            Open Prompt Workshop
          </a>
        </Reveal>
      </div>
    </main>
  );
}
