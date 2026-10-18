/**
 * Translates chapter HTML with Microsoft Translator, using the same keyless
 * token endpoint that Microsoft Edge's built-in page translation uses.
 */

const AUTH_URL = 'https://edge.microsoft.com/translate/auth';
const TRANSLATE_URL =
  'https://api-edge.cognitive.microsofttranslator.com/translate';

// Tokens are valid for ~10 minutes; refresh a bit earlier.
const TOKEN_TTL_MS = 8 * 60 * 1000;
// The API accepts up to 50k characters per request; stay under it.
const MAX_CHUNK_CHARS = 40000;

let cachedToken: { value: string; time: number } | undefined;

const getToken = async (force = false) => {
  if (!force && cachedToken && Date.now() - cachedToken.time < TOKEN_TTL_MS) {
    return cachedToken.value;
  }
  const res = await fetch(AUTH_URL);
  if (!res.ok) {
    throw new Error(`Translator auth failed (${res.status})`);
  }
  cachedToken = { value: (await res.text()).trim(), time: Date.now() };
  return cachedToken.value;
};

const requestTranslation = async (
  texts: string[],
  to: string,
  retry = true,
): Promise<string[]> => {
  const token = await getToken(!retry);
  const res = await fetch(
    `${TRANSLATE_URL}?api-version=3.0&textType=html&to=${to}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(texts.map(text => ({ Text: text }))),
    },
  );
  if (res.status === 401 && retry) {
    return requestTranslation(texts, to, false);
  }
  if (!res.ok) {
    throw new Error(`Translation failed (${res.status})`);
  }
  const data: { translations: { text: string }[] }[] = await res.json();
  return data.map(item => item.translations[0]?.text ?? '');
};

/**
 * Splits HTML at block boundaries so no chunk cuts through a tag. A single
 * block larger than the limit is sent on its own.
 */
export const splitHtml = (html: string, maxChars = MAX_CHUNK_CHARS) => {
  const blocks = html.split(
    /(?<=<\/(?:p|div|h[1-6]|li|blockquote)>|<br\s*\/?>)/i,
  );
  const chunks: string[] = [];
  let current = '';
  for (const block of blocks) {
    if (current && current.length + block.length > maxChars) {
      chunks.push(current);
      current = '';
    }
    current += block;
  }
  if (current) {
    chunks.push(current);
  }
  return chunks;
};

export const translateHtml = async (html: string, to = 'ar') => {
  const chunks = splitHtml(html);
  const translated: string[] = [];
  for (const chunk of chunks) {
    translated.push(...(await requestTranslation([chunk], to)));
  }
  return translated.join('');
};
