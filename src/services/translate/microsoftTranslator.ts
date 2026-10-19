/**
 * Translates chapter HTML with Microsoft Translator through the keyless
 * endpoint Microsoft Edge's built-in page translation uses. Edge retired its
 * token flow (`/translate/auth` now answers 404); `translatetext` needs no
 * token. It is undocumented, so it may change again.
 */

const TRANSLATE_URL = 'https://edge.microsoft.com/translate/translatetext';

// The endpoint rejects requests over 1000 strings or 50k characters.
const MAX_BATCH_ITEMS = 1000;
const MAX_BATCH_CHARS = 40000;

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36 EdgA/124.0',
};

type TranslationItem = { translations?: { text: string }[] } | string;

const requestTranslation = async (texts: string[], to: string) => {
  const res = await fetch(
    `${TRANSLATE_URL}?from=&to=${to}&isEnterpriseClient=false`,
    {
      method: 'POST',
      headers: { ...BROWSER_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify(texts),
    },
  );
  if (!res.ok) {
    throw new Error(`Translation failed (${res.status})`);
  }
  const data: TranslationItem[] = await res.json();
  return data.map(item =>
    typeof item === 'string' ? item : item.translations?.[0]?.text ?? '',
  );
};

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

const decodeEntities = (text: string) =>
  text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const num =
        code[1].toLowerCase() === 'x'
          ? parseInt(code.slice(2), 16)
          : parseInt(code.slice(1), 10);
      return Number.isNaN(num) ? match : String.fromCodePoint(num);
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

type Paragraph = { text: string } | { html: string };

/**
 * Splits chapter HTML into paragraphs of plain text. Images are kept as raw
 * HTML so they still render; other markup is dropped.
 */
export const extractParagraphs = (html: string): Paragraph[] =>
  html
    .split(/<\/(?:p|div|h[1-6]|li|blockquote)>|<br\s*\/?>/i)
    .flatMap((block): Paragraph[] => {
      const images = block.match(/<img\b[^>]*>/gi)?.join('') ?? '';
      const text = decodeEntities(block.replace(/<[^>]*>/g, ''))
        .replace(/\s+/g, ' ')
        .trim();
      return [
        ...(images ? [{ html: images }] : []),
        ...(text ? [{ text }] : []),
      ];
    });

export const translateTexts = async (texts: string[], to = 'ar') => {
  const translated: string[] = [];
  let batch: string[] = [];
  let size = 0;
  const flush = async () => {
    if (batch.length) {
      translated.push(...(await requestTranslation(batch, to)));
    }
    batch = [];
    size = 0;
  };
  for (const text of texts) {
    if (
      batch.length >= MAX_BATCH_ITEMS ||
      (batch.length && size + text.length > MAX_BATCH_CHARS)
    ) {
      await flush();
    }
    batch.push(text);
    size += text.length;
  }
  await flush();
  return translated;
};

export const translateHtml = async (html: string, to = 'ar') => {
  const parts = extractParagraphs(html);
  const texts = parts.flatMap(part => ('text' in part ? [part.text] : []));
  const translated = await translateTexts(texts, to);
  let i = 0;
  return parts
    .map(part =>
      'text' in part
        ? `<p>${escapeHtml(translated[i++] ?? '')}</p>`
        : part.html,
    )
    .join('');
};
