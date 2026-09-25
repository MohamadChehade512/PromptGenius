import type { AttachmentKind, AttachmentSource } from '@promptgenius/core';

/**
 * Files are read entirely in the browser: nothing is uploaded, stored or logged. The
 * limits keep a huge or hostile file from freezing the tab (PLAN.md §3.4).
 */
export const FILE_LIMITS = {
  maxFiles: 10,
  maxBytes: 25 * 1024 * 1024,
  /** Word files are zip archives; a lower cap limits decompression blow-ups. */
  maxDocxBytes: 10 * 1024 * 1024,
  /** Beyond this the text is cut and token counts are scaled up to the full size. */
  maxTextChars: 2_000_000,
  maxPdfPages: 1000,
} as const;

const IMAGE_TYPES = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp']);
const TEXT_TYPES = new Set(
  (
    'txt md markdown csv tsv json jsonl xml html htm yaml yml toml ini log rst tex srt vtt ' +
    'js mjs cjs ts tsx jsx py ipynb java kt kts scala c h cpp hpp cc cs go rb php rs swift m ' +
    'sql sh bash zsh ps1 css scss less vue svelte r dart lua pl ex exs hs clj erl env gitignore dockerfile'
  ).split(' '),
);

/** File-picker filter; anything else is rejected with a clear message. */
export const ACCEPT = [
  '.pdf',
  '.docx',
  ...[...IMAGE_TYPES].map((t) => `.${t}`),
  ...[...TEXT_TYPES].map((t) => `.${t}`),
  'text/*',
].join(',');

export class AttachmentError extends Error {}

function extension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : name.toLowerCase();
}

type Reader = 'pdf' | 'docx' | 'image' | 'text';

export function readerFor(file: Pick<File, 'name' | 'type'>): Reader | null {
  const ext = extension(file.name);
  if (ext === 'pdf' || file.type === 'application/pdf') return 'pdf';
  if (ext === 'docx') return 'docx';
  if (IMAGE_TYPES.has(ext)) return 'image';
  if (TEXT_TYPES.has(ext) || file.type.startsWith('text/')) return 'text';
  return null;
}

const KIND: Record<Reader, AttachmentKind> = {
  pdf: 'pdf',
  docx: 'text',
  image: 'image',
  text: 'text',
};

function capText(text: string): { text: string; truncatedRatio?: number } {
  if (text.length <= FILE_LIMITS.maxTextChars) return { text };
  return {
    text: text.slice(0, FILE_LIMITS.maxTextChars),
    truncatedRatio: text.length / FILE_LIMITS.maxTextChars,
  };
}

async function readText(file: File) {
  // A NUL byte in the first 8 KB means a binary file with a text-like extension.
  const head = new Uint8Array(await file.slice(0, 8192).arrayBuffer());
  if (head.includes(0)) throw new AttachmentError("This doesn't look like a text file.");
  return capText(await file.text());
}

async function readDocx(file: File) {
  if (file.size > FILE_LIMITS.maxDocxBytes) {
    throw new AttachmentError(
      `Word files are limited to ${FILE_LIMITS.maxDocxBytes / 1024 / 1024} MB.`,
    );
  }
  const mammoth = await import('mammoth');
  const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return capText(value);
}

async function readPdf(file: File) {
  const pdfjs = await import('pdfjs-dist');
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const task = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    // Text extraction only: no fonts, forms, scripts or rendering.
    disableFontFace: true,
    enableXfa: false,
  });
  try {
    const doc = await task.promise;
    const pages = doc.numPages;
    if (pages > FILE_LIMITS.maxPdfPages) {
      throw new AttachmentError(`PDFs are limited to ${FILE_LIMITS.maxPdfPages} pages.`);
    }
    const parts: string[] = [];
    let chars = 0;
    let readPages = 0;
    for (let i = 1; i <= pages && chars < FILE_LIMITS.maxTextChars; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
      parts.push(text);
      chars += text.length;
      readPages = i;
      page.cleanup();
    }
    const text = parts.join('\n\n');
    // Scale up for pages skipped at the character cap, then for text cut at the cap.
    const capped = capText(text);
    const pageRatio = readPages < pages ? pages / readPages : 1;
    const truncatedRatio = (capped.truncatedRatio ?? 1) * pageRatio;
    return {
      text: capped.text,
      pages,
      truncatedRatio: truncatedRatio > 1 ? truncatedRatio : undefined,
    };
  } finally {
    // Destroying the loading task frees the document and its worker.
    void task.destroy();
  }
}

async function readImage(file: File) {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    throw new AttachmentError("This image couldn't be read.");
  }
}

export async function readAttachment(file: File, id: string): Promise<AttachmentSource> {
  const reader = readerFor(file);
  if (!reader) {
    throw new AttachmentError(
      'Unsupported file type. Use PDF, Word (.docx), images (PNG, JPEG, GIF, WebP) or text/code files.',
    );
  }
  if (file.size > FILE_LIMITS.maxBytes) {
    throw new AttachmentError(`Files are limited to ${FILE_LIMITS.maxBytes / 1024 / 1024} MB.`);
  }
  const base = { id, name: file.name, kind: KIND[reader], bytes: file.size };
  switch (reader) {
    case 'text':
      return { ...base, ...(await readText(file)) };
    case 'docx':
      return { ...base, ...(await readDocx(file)) };
    case 'pdf':
      return { ...base, ...(await readPdf(file)) };
    case 'image':
      return { ...base, ...(await readImage(file)) };
  }
}
