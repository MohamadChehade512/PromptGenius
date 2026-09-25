import type { AttachmentTokens } from '@promptgenius/core';
import { useId, useRef, useState } from 'react';
import type { AttachmentItem } from '../hooks/useAttachments';
import { formatBytes, formatTokens } from '../lib/format';
import { ACCEPT, FILE_LIMITS } from '../lib/readAttachment';

function detail(item: Extract<AttachmentItem, { status: 'ready' }>): string {
  const a = item.attachment;
  if (a.kind === 'pdf') return `PDF · ${a.pages ?? '?'} page${a.pages === 1 ? '' : 's'}`;
  if (a.kind === 'image') return `Image · ${a.width}×${a.height}`;
  return `Text · ${a.textChars.toLocaleString()} characters`;
}

/**
 * Attach files to add context. They're read in the browser (never uploaded), counted
 * as input tokens, and taken into account by the score.
 */
export function AttachmentsInput(props: {
  items: AttachmentItem[];
  /** Token estimates for the selected model, by attachment id. */
  tokens: AttachmentTokens[];
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
  simple: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const [dragging, setDragging] = useState(false);
  const byId = new Map(props.tokens.map((t) => [t.id, t]));
  const total = props.tokens.reduce((s, t) => s + t.tokens, 0);

  return (
    <div className="attachments" data-tour="attachments">
      <div
        className={`dropzone${dragging ? ' dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length) props.onAdd([...e.dataTransfer.files]);
        }}
      >
        <button
          type="button"
          className="button secondary"
          onClick={() => inputRef.current?.click()}
          aria-describedby={hintId}
        >
          Attach files
        </button>
        <span className="muted">or drop them here</span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          hidden
          aria-label="Attach files"
          onChange={(e) => {
            if (e.target.files?.length) props.onAdd([...e.target.files]);
            e.target.value = '';
          }}
        />
      </div>

      {props.items.length > 0 && (
        <ul className="file-list" aria-label="Attached files">
          {props.items.map((item) => {
            const t = byId.get(item.id);
            return (
              <li key={item.id} className={`file file-${item.status}`}>
                <div className="file-main">
                  <span className="file-name" title={item.name}>
                    {item.name}
                  </span>
                  <span className="file-meta">
                    {item.status === 'reading' && 'Reading…'}
                    {item.status === 'error' && item.error}
                    {item.status === 'ready' && `${detail(item)} · ${formatBytes(item.bytes)}`}
                  </span>
                </div>
                {item.status === 'ready' && t && (
                  <span className="file-tokens">
                    ≈ {formatTokens(t.tokens)} <span className="unit">tokens</span>
                  </span>
                )}
                <button
                  type="button"
                  className="link-button"
                  onClick={() => props.onRemove(item.id)}
                  aria-label={`Remove ${item.name}`}
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="hint" id={hintId}>
        PDF, Word, images, text or code, up to {FILE_LIMITS.maxFiles} files of{' '}
        {FILE_LIMITS.maxBytes / 1024 / 1024} MB. Files are read in your browser and never uploaded.
        {total > 0 &&
          ` Together they add about ${formatTokens(total)} tokens, resent with every later message.`}
        {props.simple &&
          total > 50_000 &&
          ' Chat apps may search very large files instead of reading them whole, so actual usage can be lower.'}
      </p>
    </div>
  );
}
