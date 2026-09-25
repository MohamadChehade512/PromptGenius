import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { TUTORIAL_STEPS, type TutorialStep } from '../lib/tutorialSteps';

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 8;

function measure(target: string | undefined): Rect | null {
  if (!target) return null;
  const el = document.querySelector(`[data-tour="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    top: r.top - PAD,
    left: r.left - PAD,
    width: r.width + PAD * 2,
    height: r.height + PAD * 2,
  };
}

/**
 * A step-by-step tour: dims the page, spotlights one part at a time and explains it.
 * "Next" is at the bottom of the card, "Skip tutorial" at the top; Escape also skips.
 */
export function Tutorial(props: { onClose: () => void; steps?: TutorialStep[] }) {
  const steps = props.steps ?? TUTORIAL_STEPS;
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const bodyId = useId();
  const step = steps[index]!;
  const last = index === steps.length - 1;

  // Bring the target into view, then keep the spotlight on it while the page moves.
  useEffect(() => {
    const el = step.target && document.querySelector(`[data-tour="${step.target}"]`);
    const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (el && 'scrollIntoView' in el) {
      el.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' });
    }
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setRect(measure(step.target)));
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    // Smooth scrolling moves the target for a while; re-measure until it settles.
    const settle = window.setInterval(update, 100);
    const stop = window.setTimeout(() => window.clearInterval(settle), 700);
    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(settle);
      window.clearTimeout(stop);
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [step.target]);

  useEffect(() => {
    cardRef.current?.focus();
  }, [index]);

  const { onClose } = props;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Modal: keep keyboard focus inside the card.
  function trapFocus(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Tab' || !cardRef.current) return;
    const buttons = [...cardRef.current.querySelectorAll('button')];
    const first = buttons[0];
    const lastButton = buttons[buttons.length - 1];
    if (!first || !lastButton) return;
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === cardRef.current)) {
      e.preventDefault();
      lastButton.focus();
    } else if (!e.shiftKey && active === lastButton) {
      e.preventDefault();
      first.focus();
    }
  }

  // Put the card on the side of the screen away from the highlighted part.
  const cardAtTop = rect !== null && rect.top + rect.height / 2 > window.innerHeight / 2;
  const placement = rect === null ? 'center' : cardAtTop ? 'top' : 'bottom';

  return (
    <div className="tour">
      {rect ? (
        <div
          className="tour-spotlight"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
          aria-hidden="true"
        />
      ) : (
        <div className="tour-backdrop" aria-hidden="true" />
      )}
      <div
        ref={cardRef}
        className={`tour-card tour-${placement}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        onKeyDown={trapFocus}
      >
        <div className="tour-head">
          <span className="tour-count">
            Step {index + 1} of {steps.length}
          </span>
          {!last && (
            <button type="button" className="link-button" onClick={props.onClose}>
              Skip tutorial
            </button>
          )}
        </div>
        <h2 id={titleId}>{step.title}</h2>
        <p id={bodyId}>{step.body}</p>
        <div className="tour-dots" aria-hidden="true">
          {steps.map((s, i) => (
            <span key={s.title} className={i === index ? 'active' : undefined} />
          ))}
        </div>
        <div className="tour-actions">
          {index > 0 && (
            <button type="button" className="button secondary" onClick={() => setIndex(index - 1)}>
              Back
            </button>
          )}
          <button
            type="button"
            className="button primary"
            onClick={() => (last ? props.onClose() : setIndex(index + 1))}
          >
            {last ? 'Start using PromptGenius' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
