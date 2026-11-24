import { describe, expect, it, vi } from 'vitest';
import { defaultFormats, fetchMasterVersions, groupByFormat, selectVersionIds } from '@/lib/discogs/master';

const versions = [
  { id: 3, released: '1997', major_formats: ['CD'] },
  { id: 2, released: '1996', major_formats: ['Vinyl'] },
  { id: 9, released: '', major_formats: ['Vinyl'] },
  { id: 1, released: '1997', major_formats: ['Vinyl', 'CD'] },
  { id: 4, released: '1996', major_formats: ['Cassette'] },
];

describe('master versions', () => {
  it('groups by format, most common first', () => {
    expect(groupByFormat(versions)).toEqual([
      { format: 'Vinyl', count: 3 },
      { format: 'CD', count: 2 },
      { format: 'Cassette', count: 1 },
    ]);
  });

  it('defaults to vinyl when the album exists on vinyl', () => {
    expect(defaultFormats(groupByFormat(versions))).toEqual(['Vinyl']);
    expect(defaultFormats([{ format: 'CD', count: 2 }])).toEqual(['CD']);
  });

  it('selects the chosen formats, oldest first, unknown years last', () => {
    expect(selectVersionIds(versions, ['Vinyl'])).toEqual([2, 1, 9]);
    expect(selectVersionIds(versions, ['Cassette', 'CD'])).toEqual([4, 1, 3]);
    expect(selectVersionIds(versions, [])).toEqual([]);
  });
});

describe('fetchMasterVersions', () => {
  const page = (n: number, pages: number) =>
    new Response(JSON.stringify({ pagination: { pages }, versions: [{ id: n, major_formats: ['Vinyl'] }] }));

  it('follows the pages', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) =>
      page(Number(new URL(String(url)).searchParams.get('page')), 2),
    );
    const result = await fetchMasterVersions(26629, fetchImpl as unknown as typeof fetch);
    expect(result.map((v) => v.id)).toEqual([1, 2]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain('/masters/26629/versions?per_page=100&page=1');
  });

  it('stops politely at the page limit', async () => {
    const fetchImpl = vi.fn(async () => page(1, 50));
    await fetchMasterVersions(1, fetchImpl as unknown as typeof fetch, 3);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('fails clearly on the first page, keeps what it has after', async () => {
    const failing = vi.fn(async () => new Response('', { status: 429 }));
    await expect(fetchMasterVersions(1, failing as unknown as typeof fetch)).rejects.toThrow('429');

    let call = 0;
    const flaky = vi.fn(async () => (++call === 1 ? page(1, 3) : new Response('', { status: 500 })));
    expect((await fetchMasterVersions(1, flaky as unknown as typeof fetch)).map((v) => v.id)).toEqual([1]);
  });
});
