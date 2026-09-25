import { imageTokens } from '../../attachments';
import { getMedia } from '../../config';
import { S } from '../sources';
import type { Rule } from '../types';
import { fileUse, materialReference, VISUAL_NOUN_RE } from './helpers';

const QUOTE_FIRST_RE =
  /\b(?:quot(?:e|es|ing|ations?)|cite|citations?|page numbers?|section numbers?|line numbers?|verbatim|exact (?:wording|passages?|text))\b/;
/** Many-image requests on Claude reject images over 2000 px (vision docs, request limits). */
const CLAUDE_MANY_IMAGES = 20;
const CLAUDE_MANY_IMAGES_MAX_PX = 2000;

const fmtK = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));

/**
 * Rules that only apply when files are attached (PLAN.md §2.5c). A file adds context only
 * when the prompt says what it is and what to do with it; otherwise it just adds tokens.
 */
export const attachmentRules: Rule[] = [
  {
    id: 'context.unreferenced-file',
    dimension: 'context',
    title: "Attached file isn't mentioned",
    sources: [S.anthropicLongContext, S.openaiBestPractices, S.geminiDocuments],
    evaluate: (ctx) => {
      const use = fileUse(ctx);
      if (!use.present || use.any) return null;
      const n = ctx.attachments.length;
      return {
        penalty: use.used ? 0.2 : 0.35,
        message: `${n === 1 ? 'A file is' : `${n} files are`} attached, but the prompt never says what ${n === 1 ? 'it is' : 'they are'} or what to do with ${n === 1 ? 'it' : 'them'}.`,
        suggestion:
          'Point at the file and its role, e.g. "Using the attached Q3 report, list the three biggest cost increases."',
      };
    },
  },
  {
    id: 'context.file-mismatch',
    dimension: 'context',
    title: "Prompt's topic isn't in the file",
    sources: [S.anthropicLongContext, S.microsoftPromptEng],
    evaluate: (ctx) => {
      if (!fileUse(ctx).mismatch) return null;
      return {
        // The wrong file (or no pointer to the right part) undermines the whole request.
        penalty: 0.7,
        message:
          'None of the topic words in your prompt appear in the attached text, so the file may not be the one you meant, or the model will have to guess which part applies.',
        suggestion:
          'Check the right file is attached, or name the section or page to use, e.g. "Section 3 (Pricing) of the attached contract".',
      };
    },
  },
  {
    id: 'context.document-as-image',
    dimension: 'context',
    title: 'Document attached only as an image',
    sources: [S.anthropicVision, S.anthropicPdf, S.openaiVision],
    evaluate: ({ features, attachments }) => {
      const ref = materialReference(features);
      if (!ref || VISUAL_NOUN_RE.test(ref) || attachments.length === 0) return null;
      // Any readable file could be the document; only images and text-less scans can't be checked.
      if (attachments.some((a) => a.textChars >= 300)) return null;
      return {
        penalty: 0.35,
        message: `The prompt refers to ${ref}, but only ${attachments.length === 1 ? 'an image is' : 'images are'} attached, which PromptGenius can't read to check.`,
        suggestion:
          'Attach the document itself (PDF, Word or text). If the image is a photo of it, a text version reads more reliably and usually costs fewer tokens.',
      };
    },
  },
  {
    id: 'structure.which-file',
    dimension: 'structure',
    title: "Doesn't say which file is which",
    sources: [S.anthropicVision, S.geminiDocuments],
    evaluate: (ctx) => {
      const use = fileUse(ctx);
      if (ctx.attachments.length < 2 || !use.any || use.distinguishes) return null;
      return {
        penalty: 0.35,
        message: `${ctx.attachments.length} files are attached, but the prompt doesn't say which one to use for what.`,
        suggestion:
          'Refer to each file by name or order, e.g. "Compare the budget in Q3.pdf with the forecast in plan.xlsx", or say "both" / "each" when they get the same treatment.',
      };
    },
  },
  {
    id: 'structure.long-file-quotes',
    dimension: 'structure',
    title: 'Long file without asking for quotes',
    sources: [S.anthropicLongContext, S.lostInMiddle, S.contextRot],
    useCases: ['qa', 'analysis', 'extraction'],
    evaluate: ({ attachmentTokens, features }) =>
      attachmentTokens >= 20_000 && !QUOTE_FIRST_RE.test(features.instructionLower)
        ? {
            penalty: 0.3,
            message: `About ${fmtK(attachmentTokens)} tokens of attached material. In long documents, details in the middle are easy to miss.`,
            suggestion:
              'Ask the model to quote the relevant passages first (with page or section numbers), then answer from those quotes.',
          }
        : null,
  },
  {
    id: 'economy.large-files',
    dimension: 'economy',
    title: 'Large attachments',
    sources: [S.anthropicPdf, S.openaiFiles, S.geminiDocuments, S.contextRot],
    evaluate: ({ attachmentTokens, useCase }) => {
      if (attachmentTokens < 30_000) return null;
      // Summaries and extraction legitimately need the whole source; trimming still helps.
      const k = useCase === 'summarization' || useCase === 'extraction' ? 0.6 : 1;
      const base = attachmentTokens >= 300_000 ? 0.6 : attachmentTokens >= 100_000 ? 0.4 : 0.2;
      return {
        penalty: base * k,
        message: `The attachments add about ${fmtK(attachmentTokens)} input tokens, resent on every turn of this chat.`,
        suggestion:
          'Attach only the pages or sections the task needs (or paste the relevant excerpt). In a long chat, start a new one for unrelated questions so the file isn’t resent.',
      };
    },
  },
  {
    id: 'economy.large-images',
    dimension: 'economy',
    title: 'High-resolution images',
    sources: [S.anthropicVision, S.openaiVision, S.geminiMediaResolution],
    evaluate: ({ attachments, platform, model }) => {
      const media = getMedia(platform, model);
      if (media.image.scheme !== 'patch') return null;
      const spec = media.image;
      const big = attachments.filter(
        (a) =>
          a.kind === 'image' &&
          a.width &&
          a.height &&
          imageTokens(a.width, a.height, spec).tokens >= 2500,
      );
      if (big.length === 0) return null;
      return {
        penalty: Math.min(0.3, 0.12 * big.length),
        message: `${big.length === 1 ? 'An image costs' : `${big.length} images cost`} 2,500+ tokens each at full resolution on ${model.label}.`,
        suggestion:
          'Unless fine detail matters (small text, dense charts), downscale to about 1,000 px on the long edge first; that cuts image tokens by roughly 60–80%.',
        evidence: big.map((a) => a.name),
      };
    },
  },
  {
    id: 'claude.many-images',
    dimension: 'platformFit',
    title: 'Too many large images for one request',
    sources: [S.anthropicVision],
    platforms: ['claude'],
    evaluate: ({ attachments }) => {
      // PDFs count toward this limit only on Bedrock and Google Cloud, so only images are counted.
      const images = attachments.filter((a) => a.kind === 'image');
      if (images.length <= CLAUDE_MANY_IMAGES) return null;
      const oversized = images.filter(
        (a) => Math.max(a.width ?? 0, a.height ?? 0) > CLAUDE_MANY_IMAGES_MAX_PX,
      );
      if (oversized.length === 0) return null;
      return {
        penalty: 0.5,
        message: `With more than ${CLAUDE_MANY_IMAGES} images in one request, Claude rejects images larger than ${CLAUDE_MANY_IMAGES_MAX_PX} px on a side; ${oversized.length} of yours are.`,
        suggestion: `Resize images to ${CLAUDE_MANY_IMAGES_MAX_PX} px or less, or send ${CLAUDE_MANY_IMAGES} or fewer per message.`,
        evidence: oversized.map((a) => a.name),
      };
    },
  },
];
