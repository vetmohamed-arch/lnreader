import { extractParagraphs, translateTexts } from '../microsoftTranslator';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const response = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const translations = (...texts: string[]) =>
  texts.map(text => ({ translations: [{ text }] }));

describe('extractParagraphs', () => {
  it('turns block HTML into plain-text paragraphs and keeps images', () => {
    expect(
      extractParagraphs(
        '<h2>Chapter 1</h2><p>Hello <b>world</b> &amp; you</p><br><img src="a.png"><p>  </p><div>Bye&nbsp;now</div><blockquote>Hmm</blockquote>',
      ),
    ).toEqual([
      { text: 'Chapter 1', tag: 'h2' },
      { text: 'Hello world & you', tag: 'p' },
      { html: '<img src="a.png">' },
      { text: 'Bye now', tag: 'p' },
      { text: 'Hmm', tag: 'blockquote' },
    ]);
  });
});

describe('translateTexts', () => {
  beforeEach(() => mockFetch.mockReset());

  it('posts plain strings without a token', async () => {
    mockFetch.mockResolvedValueOnce(response(translations('مرحبا', 'وداعا')));

    await expect(translateTexts(['Hello world', 'Bye'])).resolves.toEqual([
      'مرحبا',
      'وداعا',
    ]);

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(
      'https://edge.microsoft.com/translate/translatetext?from=&to=ar&isEnterpriseClient=false',
    );
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBeUndefined();
    expect(JSON.parse(init.body)).toEqual(['Hello world', 'Bye']);
  });

  it('accepts plain string items in the response', async () => {
    mockFetch.mockResolvedValueOnce(response(['تم']));
    await expect(translateTexts(['Done'])).resolves.toEqual(['تم']);
  });

  it('throws with the status when the service fails', async () => {
    mockFetch.mockResolvedValueOnce(response('', 400));
    await expect(translateTexts(['x'])).rejects.toThrow('400');
  });
});

describe('translateTexts batching', () => {
  beforeEach(() => mockFetch.mockReset());

  it('splits large chapters into requests under the size limit', async () => {
    const texts = Array.from({ length: 3 }, (_, i) => `${i}`.repeat(25000));
    mockFetch.mockImplementation(async (_url, init) =>
      response(JSON.parse(init.body).map((t: string) => `ar-${t.length}`)),
    );

    await expect(translateTexts(texts)).resolves.toEqual([
      'ar-25000',
      'ar-25000',
      'ar-25000',
    ]);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});
