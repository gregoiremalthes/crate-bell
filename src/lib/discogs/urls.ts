import {
  CONDITIONS,
  type ConditionCode,
  DISCOGS_ORIGIN,
  MAX_FILTERS_PER_ALERT,
  NOTIFICATION_SETTINGS_PATH,
  WANTLISTER_PATH,
} from './constants';

export type DiscogsPage =
  | { kind: 'release'; id: number }
  | { kind: 'master'; id: number }
  | { kind: 'wantlister' }
  | { kind: 'wantlist' }
  | { kind: 'notification-settings' }
  | { kind: 'other' };

/** Discogs prefixes localized pages with a language code: /de/release/123, /pt_BR/master/4. */
const LOCALE = '(?:/[a-z]{2}(?:[-_][A-Za-z]{2})?)?';
const RELEASE_RE = new RegExp(`^${LOCALE}/release/(\\d+)(?:[-/]|$)`);
const MASTER_RE = new RegExp(`^${LOCALE}/master/(\\d+)(?:[-/]|$)`);
const WANTLISTER_RE = new RegExp(`^${LOCALE}/shop/mywants/?$`);
const SETTINGS_RE = new RegExp(`^${LOCALE}/settings/notifications/?$`);
const WANTLIST_RE = new RegExp(`^${LOCALE}/mywantlist/?$`);

export function parseDiscogsPage(pathname: string): DiscogsPage {
  const release = RELEASE_RE.exec(pathname);
  if (release) return { kind: 'release', id: Number(release[1]) };
  const master = MASTER_RE.exec(pathname);
  if (master) return { kind: 'master', id: Number(master[1]) };
  if (WANTLISTER_RE.test(pathname)) return { kind: 'wantlister' };
  if (SETTINGS_RE.test(pathname)) return { kind: 'notification-settings' };
  if (WANTLIST_RE.test(pathname)) return { kind: 'wantlist' };
  return { kind: 'other' };
}

/** What the user wants their alerts to filter on by default (set once in the preferences). */
export interface AlertFilters {
  minMediaCondition: ConditionCode | 'any';
  minSleeveCondition: ConditionCode | 'any';
  hideGenericSleeves: boolean;
  shipsFrom: string[];
  minSellerRating: number;
}

export const NO_FILTERS: AlertFilters = {
  minMediaCondition: 'any',
  minSleeveCondition: 'any',
  hideGenericSleeves: false,
  shipsFrom: [],
  minSellerRating: 0,
};

/** Every grade at or above the minimum, as Discogs facet values. Empty means "any grade". */
export function conditionsAtOrAbove(min: ConditionCode | 'any'): string[] {
  if (min === 'any') return [];
  const index = CONDITIONS.findIndex((c) => c.code === min);
  if (index < 0) return [];
  return CONDITIONS.slice(0, index + 1).map((c) => c.label);
}

/** Number of Discogs filters the preferences will add to an alert. */
export function countFilterFacets(filters: AlertFilters): number {
  return (
    conditionsAtOrAbove(filters.minMediaCondition).length +
    conditionsAtOrAbove(filters.minSleeveCondition).length +
    (filters.hideGenericSleeves ? 1 : 0) +
    filters.shipsFrom.length +
    (filters.minSellerRating > 0 ? 1 : 0)
  );
}

export interface WantlisterUrlResult {
  url: string;
  /** Release ids that made it into the URL (may be fewer than requested). */
  releaseIds: number[];
  /** True when some release ids were dropped to stay under Discogs' filter limit. */
  truncated: boolean;
}

/**
 * Builds the "Items I Want" URL that opens with the release(s) and the user's usual filters applied.
 * Discogs refuses to save an alert with more than 100 filters, so release ids are capped first
 * and the user's own preferences are kept.
 */
export function buildWantlisterUrl(releaseIds: number[], filters: AlertFilters = NO_FILTERS): WantlisterUrlResult {
  const unique = [...new Set(releaseIds.filter((id) => Number.isInteger(id) && id > 0))];
  const room = Math.max(1, MAX_FILTERS_PER_ALERT - countFilterFacets(filters));
  const kept = unique.slice(0, room);

  const url = new URL(WANTLISTER_PATH, DISCOGS_ORIGIN);
  for (const id of kept) url.searchParams.append('release', String(id));
  for (const value of conditionsAtOrAbove(filters.minMediaCondition)) {
    url.searchParams.append('mediaCondition', value);
  }
  for (const value of conditionsAtOrAbove(filters.minSleeveCondition)) {
    url.searchParams.append('sleeveCondition', value);
  }
  if (filters.hideGenericSleeves) url.searchParams.set('hideGenericSleeves', 'true');
  for (const country of filters.shipsFrom) url.searchParams.append('shipsFrom', country);
  if (filters.minSellerRating > 0) {
    url.searchParams.set('sellerRatingMin', String(filters.minSellerRating));
  }

  return { url: url.toString(), releaseIds: kept, truncated: kept.length < unique.length };
}

/** Release ids currently applied on a Wantlister URL. */
export function releaseIdsFromSearch(search: string): number[] {
  return new URLSearchParams(search)
    .getAll('release')
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0);
}

export const notificationSettingsUrl = (): string => new URL(NOTIFICATION_SETTINGS_PATH, DISCOGS_ORIGIN).toString();

export const wantlisterHomeUrl = (): string => new URL(WANTLISTER_PATH, DISCOGS_ORIGIN).toString();

export const loginUrl = (returnTo: string): string => {
  const url = new URL('/login', DISCOGS_ORIGIN);
  url.searchParams.set('return_to', returnTo);
  return url.toString();
};
