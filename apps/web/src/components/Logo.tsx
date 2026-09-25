import { useId } from 'react';

const SPARK =
  'M51 2.5C52.2 10 54 11.8 61.5 13 54 14.2 52.2 16 51 23.5 49.8 16 48 14.2 40.5 13 48 11.8 49.8 10 51 2.5Z';

/**
 * The PromptGenius mark: a chat bubble (the prompt) holding a `>_` cursor, with a spark
 * (the "genius"). Same artwork as public/logo-mark.svg; ids are unique per instance so
 * several logos can share a page.
 */
export function Logo({ size = 32, title }: { size?: number; title?: string }) {
  const id = useId();
  const bubble = `${id}-bubble`;
  const spark = `${id}-spark`;
  const gap = `${id}-gap`;
  return (
    <svg
      className="logo"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <linearGradient id={bubble} x1="6" y1="10" x2="52" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3b8bea" />
          <stop offset="1" stopColor="#1d5bb5" />
        </linearGradient>
        <linearGradient id={spark} x1="41" y1="2" x2="61" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffd35c" />
          <stop offset="1" stopColor="#f29f05" />
        </linearGradient>
        <mask id={gap}>
          <rect width="64" height="64" fill="#fff" />
          <path d={SPARK} fill="#000" stroke="#000" strokeWidth="5" strokeLinejoin="round" />
        </mask>
      </defs>
      <g mask={`url(#${gap})`}>
        <path
          d="M18 10h22a12 12 0 0 1 12 12v14a12 12 0 0 1-12 12H26l-11.5 9.2c-1 .8-2.4 0-2.2-1.3L13.6 47A12 12 0 0 1 6 36V22a12 12 0 0 1 12-12Z"
          fill={`url(#${bubble})`}
        />
      </g>
      <path
        d="M17.5 23l8 6-8 6"
        fill="none"
        stroke="#fff"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M30 35h10" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" />
      <path d={SPARK} fill={`url(#${spark})`} />
    </svg>
  );
}

/** Mark + "PromptGenius" wordmark, with "Genius" in the accent color. */
export function Wordmark({ size = 32 }: { size?: number }) {
  return (
    <span className="wordmark">
      <Logo size={size} />
      <span className="wordmark-text">
        Prompt<span className="wordmark-accent">Genius</span>
      </span>
    </span>
  );
}
