/**
 * Facts about Discogs that the extension relies on.
 * Every value here was observed on the live site (see docs/discovery.md).
 * If Discogs changes something, this file and selectors.ts are the places to update.
 */

export const DISCOGS_ORIGIN = 'https://www.discogs.com';

/** The Wantlister page, called "Items I Want" / "Shop My Wants" in the Discogs UI. */
export const WANTLISTER_PATH = '/shop/mywants/';

/** Global email switch that every sale alert depends on. */
export const NOTIFICATION_SETTINGS_PATH = '/settings/notifications';

/** `input[name="email"][value="5"]` is "When a release in my wantlist is listed for sale". */
export const WANTLIST_EMAIL_SETTING_VALUE = '5';

/** Discogs counts every selected filter value. Above this, the alert cannot be saved. */
export const MAX_FILTERS_PER_ALERT = 100;

/** Discogs accepts at most this many saved searches per account. */
export const MAX_SAVED_ALERTS = 300;

/** Discogs accepts at most this many saved searches with a daily digest. */
export const MAX_DAILY_DIGEST_ALERTS = 30;

/** Discogs limits a saved search name to this many characters. */
export const MAX_ALERT_NAME_LENGTH = 100;

/** Grades in Discogs order, best first. Values are the exact facet strings. */
export const CONDITIONS = [
  { code: 'M', label: 'Mint (M)' },
  { code: 'NM', label: 'Near Mint (NM or M-)' },
  { code: 'VG+', label: 'Very Good Plus (VG+)' },
  { code: 'VG', label: 'Very Good (VG)' },
  { code: 'G+', label: 'Good Plus (G+)' },
  { code: 'G', label: 'Good (G)' },
  { code: 'F', label: 'Fair (F)' },
  { code: 'P', label: 'Poor (P)' },
] as const;

export type ConditionCode = (typeof CONDITIONS)[number]['code'];

/** Seller rating thresholds offered in the preferences. 0 means no minimum. */
export const SELLER_RATING_OPTIONS = [0, 90, 95, 98, 99] as const;

/**
 * Ships From values as Discogs spells them in its filter list.
 * A curated subset: the full list has 280+ entries.
 */
export const SHIPS_FROM_EU = [
  'Austria',
  'Belgium',
  'Bulgaria',
  'Croatia',
  'Cyprus',
  'Czech Republic',
  'Denmark',
  'Estonia',
  'Finland',
  'France',
  'Germany',
  'Greece',
  'Hungary',
  'Ireland',
  'Italy',
  'Latvia',
  'Lithuania',
  'Luxembourg',
  'Malta',
  'Netherlands',
  'Poland',
  'Portugal',
  'Romania',
  'Slovak Republic',
  'Slovenia',
  'Spain',
  'Sweden',
] as const;

export const SHIPS_FROM_OTHER = [
  'United Kingdom',
  'Switzerland',
  'Norway',
  'United States',
  'Canada',
  'Japan',
  'Australia',
  'New Zealand',
] as const;

export const SHIPS_FROM_OPTIONS = [...SHIPS_FROM_EU, ...SHIPS_FROM_OTHER].sort((a, b) => a.localeCompare(b));

/** Major formats as returned by the Discogs API for master versions. */
export const KNOWN_FORMATS = ['Vinyl', 'CD', 'Cassette', 'Box Set', 'CDr', 'File'] as const;
