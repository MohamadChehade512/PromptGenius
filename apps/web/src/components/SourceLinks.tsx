import type { Source } from '@promptgenius/core';

/** "Sources: Anthropic · OpenAI · Google": one link per source, labeled by publisher. */
export function SourceLinks({ sources }: { sources: readonly Source[] }) {
  return (
    <p className="sources">
      Sources:{' '}
      {sources.map((s, i) => (
        <span key={s.url}>
          {i > 0 && ' · '}
          <a href={s.url} target="_blank" rel="noreferrer noopener" title={s.title}>
            {s.publisher === 'Research' ? s.title.split(',')[0] : s.publisher}
          </a>
        </span>
      ))}
    </p>
  );
}
