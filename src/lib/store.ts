import { storage } from 'wxt/utils/storage';
import type { EmailSettingState } from './discogs/selectors';
import { type AlertFilters, NO_FILTERS } from './discogs/urls';

/** Everything is stored locally in the browser. Nothing is ever sent anywhere. */

export type Frequency = 'realtime' | 'digest';

export interface Prefs extends AlertFilters {
  /** How Discogs should email: as soon as a copy is listed, or once a day. */
  frequency: Frequency;
  /** Formats picked last time on a master page. */
  masterFormats: string[];
}

export const DEFAULT_PREFS: Prefs = {
  ...NO_FILTERS,
  frequency: 'realtime',
  masterFormats: [],
};

export const prefsItem = storage.defineItem<Prefs>('local:prefs', {
  fallback: DEFAULT_PREFS,
  version: 1,
});

export async function getPrefs(): Promise<Prefs> {
  // Merge so that preferences added in later versions get their default value.
  return { ...DEFAULT_PREFS, ...(await prefsItem.getValue()) };
}

export async function updatePrefs(patch: Partial<Prefs>): Promise<Prefs> {
  const next = { ...(await getPrefs()), ...patch };
  await prefsItem.setValue(next);
  return next;
}

/** Handoff from a record page to the alert page, so the guide knows what to pre-fill. */
export interface PendingAlert {
  kind: 'release' | 'master';
  releaseIds: number[];
  name: string;
  frequency: Frequency;
  createdAt: number;
  /** Master only: some versions were left out to stay under Discogs' 100-filter limit. */
  truncated?: boolean;
}

export const pendingAlertItem = storage.defineItem<PendingAlert | null>('local:pendingAlert', {
  fallback: null,
});

/** A pending alert is only valid for a few minutes, so an old one never pre-fills by surprise. */
export const PENDING_TTL_MS = 10 * 60 * 1000;

export function isPendingFresh(pending: PendingAlert | null, now = Date.now()): pending is PendingAlert {
  return !!pending && now - pending.createdAt < PENDING_TTL_MS;
}

/** Does the pending alert match the release filters on the page the user landed on? */
export function pendingMatchesPage(pending: PendingAlert, pageReleaseIds: number[]): boolean {
  if (!pageReleaseIds.length) return false;
  const onPage = new Set(pageReleaseIds);
  return pending.releaseIds.length === onPage.size && pending.releaseIds.every((id) => onPage.has(id));
}

export interface EmailStatus {
  state: EmailSettingState;
  checkedAt: number;
}

export const emailStatusItem = storage.defineItem<EmailStatus | null>('local:emailStatus', {
  fallback: null,
});

/** Re-read the Discogs setting at most this often while browsing. */
export const EMAIL_STATUS_TTL_MS = 6 * 60 * 60 * 1000;

export const alertsSetItem = storage.defineItem<number>('local:alertsSet', { fallback: 0 });
