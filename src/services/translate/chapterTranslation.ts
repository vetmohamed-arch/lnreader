import NativeFile from '@modules/native-file';
import { TRANSLATION_STORAGE } from '@utils/Storages';
import { getMMKVObject } from '@utils/mmkv/mmkv';
import {
  CHAPTER_GENERAL_SETTINGS,
  ChapterGeneralSettings,
} from '@hooks/persisted/useSettings';
import {
  escapeHtml,
  extractParagraphs,
  translateTexts as translateWithEdge,
} from './microsoftTranslator';
import { translateWithGoogle } from './googleTranslator';
import { applyGlossary, glossaryKey, parseGlossary } from './glossary';
import { BUILTIN_GLOSSARY } from './builtinGlossary';

/**
 * The glossary actually used: the user's lines first so they win over a
 * built-in entry for the same term.
 */
export const effectiveGlossary = (user: string, useBuiltin: boolean) =>
  useBuiltin ? `${user}\n${BUILTIN_GLOSSARY}` : user;

export type TranslatedPart =
  | { html: string }
  | { tag: string; original: string; text: string };

/** Edge first since it reads best; Google when Edge is down or changed. */
export const translateWithFallback = async (
  texts: string[],
  to = 'ar',
  from = '',
) => {
  try {
    return await translateWithEdge(texts, to, from);
  } catch (edgeError: any) {
    try {
      return await translateWithGoogle(texts, to, from);
    } catch (googleError: any) {
      throw new Error(
        `Edge: ${edgeError?.message ?? edgeError}; Google: ${
          googleError?.message ?? googleError
        }`,
      );
    }
  }
};

/**
 * Glossary terms put Arabic inside the source text, and auto-detection then
 * takes such a paragraph for Arabic and returns it untranslated. So a chapter
 * that is mostly Latin letters is sent as English; anything else is detected.
 */
export const detectSource = (texts: string[]) => {
  const all = texts.join('');
  const latin = all.match(/[A-Za-z]/g)?.length ?? 0;
  const letters =
    all.match(
      /[A-Za-z\u00C0-\u024F\u0600-\u06FF\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF\u0400-\u04FF]/g,
    )?.length ?? 0;
  return letters && latin / letters > 0.8 ? 'en' : '';
};

export const translateChapterParts = async (
  html: string,
  glossary: string,
): Promise<TranslatedPart[]> => {
  const entries = parseGlossary(glossary);
  const parts = extractParagraphs(html);
  const texts = parts.flatMap(part =>
    'text' in part ? [applyGlossary(part.text, entries)] : [],
  );
  const originals = parts.flatMap(part => ('text' in part ? [part.text] : []));
  const translated = await translateWithFallback(
    texts,
    'ar',
    detectSource(originals),
  );
  let i = 0;
  return parts.map(part =>
    'text' in part
      ? {
          tag: part.tag,
          original: part.text,
          text: applyGlossary(translated[i++] ?? '', entries),
        }
      : part,
  );
};

export const renderTranslation = (
  parts: TranslatedPart[],
  bilingual: boolean,
) =>
  `<div class="translated-ar" dir="rtl" lang="ar">${parts
    .map(part => {
      if ('html' in part) return part.html;
      const { tag, original, text } = part;
      const source = bilingual
        ? `<${tag} class="translation-original" dir="auto">${escapeHtml(
            original,
          )}</${tag}>`
        : '';
      return `${source}<${tag}>${escapeHtml(text)}</${tag}>`;
    })
    .join('')}</div>`;

const cacheFile = (
  pluginId: string,
  novelId: number,
  chapterId: number,
  glossary: string,
) => {
  const key = glossaryKey(parseGlossary(glossary));
  const dir = `${TRANSLATION_STORAGE}/v3/ar/${pluginId}/${novelId}`;
  return { dir, path: `${dir}/${chapterId}${key ? `-${key}` : ''}.json` };
};

/**
 * Translates a chapter once and keeps it on disk, so it stays readable
 * offline. A changed glossary is cached separately and translated again.
 */
export const getChapterTranslation = async (
  chapter: { pluginId: string; novelId: number; chapterId: number },
  html: string,
  glossary: string,
): Promise<TranslatedPart[]> => {
  const { dir, path } = cacheFile(
    chapter.pluginId,
    chapter.novelId,
    chapter.chapterId,
    glossary,
  );
  try {
    return JSON.parse(await NativeFile.readFile(path));
  } catch {
    // Not translated yet.
  }
  const parts = await translateChapterParts(html, glossary);
  // A failed save only costs offline access; still return the translation.
  try {
    await NativeFile.mkdir(dir);
    await NativeFile.writeFile(path, JSON.stringify(parts));
  } catch {}
  return parts;
};

/** Translation settings for code outside React, such as downloads. */
export const getTranslationSettings = () => {
  const settings = getMMKVObject<ChapterGeneralSettings>(
    CHAPTER_GENERAL_SETTINGS,
  );
  return {
    translateOnDownload: Boolean(settings?.translateOnDownload),
    glossary: effectiveGlossary(
      settings?.translationGlossary ?? '',
      settings?.translationBuiltinGlossary !== false,
    ),
    bilingual: Boolean(settings?.translationBilingual),
  };
};
