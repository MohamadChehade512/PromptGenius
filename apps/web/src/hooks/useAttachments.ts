import { summarizeAttachment, type Attachment } from '@promptgenius/core';
import { useCallback, useMemo, useState } from 'react';
import { AttachmentError, FILE_LIMITS, readAttachment } from '../lib/readAttachment';

export type AttachmentItem =
  | { id: string; name: string; bytes: number; status: 'reading' }
  | { id: string; name: string; bytes: number; status: 'ready'; attachment: Attachment }
  | { id: string; name: string; bytes: number; status: 'error'; error: string };

let counter = 0;
const nextId = () => `file-${Date.now().toString(36)}-${(counter++).toString(36)}`;

/**
 * Attached files, read and summarized in the browser. Like the prompt, they live in
 * memory only: nothing is uploaded or persisted, and a reload clears them.
 */
export function useAttachments() {
  const [items, setItems] = useState<AttachmentItem[]>([]);

  const update = useCallback((id: string, next: AttachmentItem) => {
    // A file removed while it was being read is simply dropped.
    setItems((all) => all.map((it) => (it.id === id ? next : it)));
  }, []);

  const count = items.length;
  const add = useCallback(
    (files: Iterable<File>) => {
      const list = [...files];
      const room = Math.max(0, FILE_LIMITS.maxFiles - count);
      const accepted = list.slice(0, room).map((file) => ({ file, id: nextId() }));
      const rejected = list.slice(room).map((file): AttachmentItem => ({
        id: nextId(),
        name: file.name,
        bytes: file.size,
        status: 'error',
        error: `Up to ${FILE_LIMITS.maxFiles} files can be attached.`,
      }));
      setItems((current) => [
        ...current,
        ...accepted.map(({ file, id }): AttachmentItem => ({
          id,
          name: file.name,
          bytes: file.size,
          status: 'reading',
        })),
        ...rejected,
      ]);
      for (const { file, id } of accepted) {
        const meta = { id, name: file.name, bytes: file.size };
        readAttachment(file, id)
          .then((src) =>
            update(id, { ...meta, status: 'ready', attachment: summarizeAttachment(src) }),
          )
          .catch((e: unknown) => {
            if (import.meta.env.DEV && !(e instanceof AttachmentError)) console.error(e);
            update(id, {
              ...meta,
              status: 'error',
              error: e instanceof AttachmentError ? e.message : "This file couldn't be read.",
            });
          });
      }
    },
    [count, update],
  );

  const remove = useCallback((id: string) => {
    setItems((all) => all.filter((it) => it.id !== id));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const attachments = useMemo(
    () => items.flatMap((it) => (it.status === 'ready' ? [it.attachment] : [])),
    [items],
  );

  return { items, attachments, add, remove, clear };
}
