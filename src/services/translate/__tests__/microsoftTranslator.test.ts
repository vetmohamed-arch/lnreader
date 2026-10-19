import { splitHtml, translateHtml } from '../microsoftTranslator';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const response = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => String(body),
  json: async () => body,
});

describe('splitHtml', () => {
  it('splits only at block boundaries and keeps every character', () => {
    const html = '<p>one</p><p>two</p><p>three</p>';
    const chunks = splitHtml(html, 12);
    expect(chunks).toEqual(['<p>one</p>', '<p>two</p>', '<p>three</p>']);
    expect(chunks.join('')).toBe(html);
  });

  it('keeps small chapters in one chunk', () => {
    expect(splitHtml('<p>a</p><br><p>b</p>')).toHaveLength(1);
  });
});

describe('translateHtml', () => {
  beforeEach(() => mockFetch.mockReset());

  it('sends chapter HTML and joins the translated chunks', async () => {
    mockFetch
      .mockResolvedValueOnce(response('token'))
      .mockResolvedValueOnce(
        response([{ translations: [{ text: '<p>مرحبا</p>' }] }]),
      );

    await expect(translateHtml('<p>Hello</p>')).resolves.toBe('<p>مرحبا</p>');

    const [url, init] = mockFetch.mock.calls[1];
    expect(url).toContain('to=ar');
    expect(url).toContain('textType=html');
    expect(init.headers.Authorization).toBe('Bearer token');
    expect(JSON.parse(init.body)).toEqual([{ Text: '<p>Hello</p>' }]);
  });

  it('refreshes the token once when it has expired', async () => {
    mockFetch
      .mockResolvedValueOnce(response('', 401))
      .mockResolvedValueOnce(response('fresh'))
      .mockResolvedValueOnce(
        response([{ translations: [{ text: '<p>تم</p>' }] }]),
      );

    await expect(translateHtml('<p>Done</p>')).resolves.toBe('<p>تم</p>');
    expect(mockFetch.mock.calls[2][1].headers.Authorization).toBe(
      'Bearer fresh',
    );
  });

  it('throws when the service fails', async () => {
    mockFetch.mockResolvedValueOnce(response('', 500));
    await expect(translateHtml('<p>x</p>')).rejects.toThrow('500');
  });
});
