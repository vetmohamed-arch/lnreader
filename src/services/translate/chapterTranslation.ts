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

export type TranslatedPart =
  | { html: string }
  | { tag: string; original: string; text: string };

/** Edge first since it reads best; Google when Edge is down or changed. */
export const translateWithFallback = async (texts: string[], to = 'ar') => {
  try {
    return await translateWithEdge(texts, to);
  } catch (edgeError: any) {
    try {
      return await translateWithGoogle(texts, to);
    } catch (googleError: any) {
      throw new Error(
        `Edge: ${edgeError?.message ?? edgeError}; Google: ${
          googleError?.message ?? googleError
        }`,
      );
    }
  }
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
  const translated = await translateWithFallback(texts);
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
    glossary: settings?.translationGlossary ?? '',
    bilingual: Boolean(settings?.translationBilingual),
  };
};
