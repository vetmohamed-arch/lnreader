import NativeFile from '@modules/native-file';
import {
  getChapterTranslation,
  renderTranslation,
  translateChapterParts,
} from '../chapterTranslation';
import { applyGlossary, glossaryKey, parseGlossary } from '../glossary';

jest.mock('@utils/Storages', () => ({ TRANSLATION_STORAGE: '/t' }));

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const response = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const edgeEcho = async (_url: string, init: { body: string }) =>
  response(JSON.parse(init.body).map((t: string) => `ar:${t}`));

beforeEach(() => {
  mockFetch.mockReset();
  jest.mocked(NativeFile.readFile).mockReset();
  jest.mocked(NativeFile.writeFile).mockReset();
  jest.mocked(NativeFile.mkdir).mockReset();
});

describe('glossary', () => {
  it('parses lines and replaces whole terms, longest first', () => {
    const entries = parseGlossary(
      'Dragon = تنين\nAzure Dragon Sect = طائفة التنين اللازوردي\nbad line\n',
    );
    expect(entries.map(e => e.from)).toEqual(['Azure Dragon Sect', 'Dragon']);
    expect(
      applyGlossary('The azure dragon sect saw a Dragon. Dragonfly!', entries),
    ).toBe('The طائفة التنين اللازوردي saw a تنين. Dragonfly!');
  });

  it('keys a glossary by content and gives none to an empty one', () => {
    expect(glossaryKey([])).toBe('');
    expect(glossaryKey(parseGlossary('a = ب'))).toBe(
      glossaryKey(parseGlossary(' a=ب ')),
    );
    expect(glossaryKey(parseGlossary('a = ب'))).not.toBe(
      glossaryKey(parseGlossary('a = ج')),
    );
  });
});

describe('translateChapterParts', () => {
  it('applies the glossary before and after translating and keeps tags', async () => {
    mockFetch.mockImplementation(edgeEcho);
    await expect(
      translateChapterParts(
        '<h1>Qi</h1><p>Gather Qi</p><img src="x">',
        'Qi = تشي\nar:Gather = اجمع',
      ),
    ).resolves.toEqual([
      { tag: 'h1', original: 'Qi', text: 'ar:تشي' },
      { tag: 'p', original: 'Gather Qi', text: 'اجمع تشي' },
      { html: '<img src="x">' },
    ]);
  });

  it('falls back to Google when Edge fails', async () => {
    mockFetch.mockResolvedValueOnce(response('', 404)).mockResolvedValueOnce(
      response([
        [
          ['أ\n', 'A\n'],
          ['ب', 'B'],
        ],
      ]),
    );
    const parts = await translateChapterParts('<p>A</p><p>B</p>', '');
    expect(parts.map(p => ('text' in p ? p.text : ''))).toEqual(['أ', 'ب']);
    expect(mockFetch.mock.calls[1][0]).toContain('translate.googleapis.com');
    expect(mockFetch.mock.calls[1][1].body).toBe(
      `q=${encodeURIComponent('A\nB')}`,
    );
  });

  it('retries Google one paragraph at a time when lines do not match', async () => {
    mockFetch
      .mockResolvedValueOnce(response('', 500))
      .mockResolvedValueOnce(response([[['أب', 'A\nB']]]))
      .mockResolvedValueOnce(response([[['أ', 'A']]]))
      .mockResolvedValueOnce(response([[['ب', 'B']]]));
    const parts = await translateChapterParts('<p>A</p><p>B</p>', '');
    expect(parts.map(p => ('text' in p ? p.text : ''))).toEqual(['أ', 'ب']);
  });

  it('reports both errors when every translator fails', async () => {
    mockFetch
      .mockResolvedValueOnce(response('', 404))
      .mockResolvedValueOnce(response('', 429));
    await expect(translateChapterParts('<p>A</p>', '')).rejects.toThrow(
      'Edge: Translation failed (404); Google: Google translation failed (429)',
    );
  });
});

describe('renderTranslation', () => {
  const parts = [
    { tag: 'h2', original: 'One', text: 'واحد' },
    { html: '<img src="x">' },
    { tag: 'p', original: 'a < b', text: 'أ < ب' },
  ];

  it('renders escaped Arabic in an RTL wrapper', () => {
    expect(renderTranslation(parts, false)).toBe(
      '<div class="translated-ar" dir="rtl" lang="ar"><h2>واحد</h2><img src="x"><p>أ &lt; ب</p></div>',
    );
  });

  it('puts the original above each paragraph in bilingual mode', () => {
    expect(renderTranslation(parts, true)).toContain(
      '<p class="translation-original" dir="auto">a &lt; b</p><p>أ &lt; ب</p>',
    );
  });
});

describe('getChapterTranslation', () => {
  const chapter = { pluginId: 'fz', novelId: 1, chapterId: 7 };

  it('uses the cached translation without calling the network', async () => {
    jest
      .mocked(NativeFile.readFile)
      .mockResolvedValue(JSON.stringify([{ html: '<hr>' }]));
    await expect(
      getChapterTranslation(chapter, '<p>A</p>', ''),
    ).resolves.toEqual([{ html: '<hr>' }]);
    expect(NativeFile.readFile).toHaveBeenCalledWith('/t/v3/ar/fz/1/7.json');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('translates, saves under a glossary-specific name, and survives a failed save', async () => {
    jest.mocked(NativeFile.readFile).mockRejectedValue(new Error('missing'));
    jest.mocked(NativeFile.writeFile).mockRejectedValue(new Error('full'));
    mockFetch.mockImplementation(edgeEcho);
    await expect(
      getChapterTranslation(chapter, '<p>A</p>', 'A = أ'),
    ).resolves.toEqual([{ tag: 'p', original: 'A', text: 'ar:أ' }]);
    const path = jest.mocked(NativeFile.writeFile).mock.calls[0][0];
    expect(path).toMatch(/^\/t\/v3\/ar\/fz\/1\/7-[a-z0-9]+\.json$/);
  });
});
