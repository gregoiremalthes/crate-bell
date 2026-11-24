import { describe, expect, it } from 'vitest';
import {
  buildWantlisterUrl,
  conditionsAtOrAbove,
  countFilterFacets,
  NO_FILTERS,
  parseDiscogsPage,
  releaseIdsFromSearch,
} from '@/lib/discogs/urls';

describe('parseDiscogsPage', () => {
  it.each([
    ['/release/3263269-Seiji-Seiji5', { kind: 'release', id: 3263269 }],
    ['/release/3263269', { kind: 'release', id: 3263269 }],
    ['/de/release/3235-Daft-Punk-Homework', { kind: 'release', id: 3235 }],
    ['/pt_BR/release/3235-x', { kind: 'release', id: 3235 }],
    ['/master/26629-Daft-Punk-Homework', { kind: 'master', id: 26629 }],
    ['/fr/master/26629', { kind: 'master', id: 26629 }],
    ['/shop/mywants/', { kind: 'wantlister' }],
    ['/shop/mywants', { kind: 'wantlister' }],
    ['/de/shop/mywants', { kind: 'wantlister' }],
    ['/settings/notifications', { kind: 'notification-settings' }],
    ['/mywantlist', { kind: 'wantlist' }],
    ['/de/mywantlist', { kind: 'wantlist' }],
  ])('recognises %s', (path, expected) => {
    expect(parseDiscogsPage(path)).toEqual(expected);
  });

  it.each([
    '/',
    '/artist/1289-Daft-Punk',
    '/release/abc',
    '/sell/release/3235',
    '/shop/mywants/extra',
    '/releases/3235',
  ])('ignores %s', (path) => {
    expect(parseDiscogsPage(path)).toEqual({ kind: 'other' });
  });
});

describe('conditions', () => {
  it('lists every grade at or above the minimum, best first', () => {
    expect(conditionsAtOrAbove('VG+')).toEqual(['Mint (M)', 'Near Mint (NM or M-)', 'Very Good Plus (VG+)']);
    expect(conditionsAtOrAbove('M')).toEqual(['Mint (M)']);
    expect(conditionsAtOrAbove('any')).toEqual([]);
  });

  it('counts the filters the preferences add', () => {
    expect(countFilterFacets(NO_FILTERS)).toBe(0);
    expect(
      countFilterFacets({
        minMediaCondition: 'NM',
        minSleeveCondition: 'VG+',
        hideGenericSleeves: true,
        shipsFrom: ['Germany', 'France'],
        minSellerRating: 98,
      }),
    ).toBe(2 + 3 + 1 + 2 + 1);
  });
});

describe('buildWantlisterUrl', () => {
  it('builds the plain URL the user asked for', () => {
    const { url, releaseIds, truncated } = buildWantlisterUrl([3263269]);
    expect(url).toBe('https://www.discogs.com/shop/mywants/?release=3263269');
    expect(releaseIds).toEqual([3263269]);
    expect(truncated).toBe(false);
  });

  it('adds the usual filters with the exact Discogs values', () => {
    const { url } = buildWantlisterUrl([1], {
      minMediaCondition: 'VG+',
      minSleeveCondition: 'any',
      hideGenericSleeves: true,
      shipsFrom: ['United Kingdom'],
      minSellerRating: 90,
    });
    const params = new URL(url).searchParams;
    expect(params.getAll('mediaCondition')).toEqual(['Mint (M)', 'Near Mint (NM or M-)', 'Very Good Plus (VG+)']);
    expect(params.get('hideGenericSleeves')).toBe('true');
    expect(params.getAll('shipsFrom')).toEqual(['United Kingdom']);
    expect(params.get('sellerRatingMin')).toBe('90');
    expect(params.has('sleeveCondition')).toBe(false);
  });

  it('removes duplicates and invalid ids', () => {
    expect(buildWantlisterUrl([5, 5, -1, 0, Number.NaN, 7]).releaseIds).toEqual([5, 7]);
  });

  it('stays under the 100 filters Discogs accepts, keeping the preferences', () => {
    const ids = Array.from({ length: 150 }, (_, i) => i + 1);
    const filters = { ...NO_FILTERS, minMediaCondition: 'NM' as const, shipsFrom: ['Germany'] };
    const result = buildWantlisterUrl(ids, filters);
    expect(result.releaseIds).toHaveLength(97);
    expect(result.truncated).toBe(true);
    const params = new URL(result.url).searchParams;
    expect(
      params.getAll('release').length + params.getAll('mediaCondition').length + params.getAll('shipsFrom').length,
    ).toBe(100);
  });
});

describe('releaseIdsFromSearch', () => {
  it('reads every release filter', () => {
    expect(releaseIdsFromSearch('?release=1&release=22&shipsFrom=Germany')).toEqual([1, 22]);
    expect(releaseIdsFromSearch('')).toEqual([]);
  });
});
