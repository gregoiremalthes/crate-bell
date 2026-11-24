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

/** Pending alerts by record, so several tabs can each prepare their own alert. */
export const pendingAlertsItem = storage.defineItem<Record<string, PendingAlert>>('local:pendingAlerts', {
  fallback: {},
});

/** A pending alert is only valid for a few minutes, so an old one never pre-fills by surprise. */
export const PENDING_TTL_MS = 10 * 60 * 1000;

export function isPendingFresh(pending: PendingAlert | null | undefined, now = Date.now()): pending is PendingAlert {
  return !!pending && now - pending.createdAt < PENDING_TTL_MS;
}

/** The same set of releases gives the same key, whatever the order in the URL. */
export const pendingKey = (releaseIds: number[]): string => [...new Set(releaseIds)].sort((a, b) => a - b).join(',');

/** Does the pending alert match the release filters on the page the user landed on? */
export function pendingMatchesPage(pending: PendingAlert, pageReleaseIds: number[]): boolean {
  return pageReleaseIds.length > 0 && pendingKey(pending.releaseIds) === pendingKey(pageReleaseIds);
}

const withoutExpired = (all: Record<string, PendingAlert>, now = Date.now()) =>
  Object.fromEntries(Object.entries(all).filter(([, p]) => isPendingFresh(p, now)));

export async function savePendingAlert(pending: PendingAlert): Promise<void> {
  const all = withoutExpired(await pendingAlertsItem.getValue());
  all[pendingKey(pending.releaseIds)] = pending;
  await pendingAlertsItem.setValue(all);
}

export async function findPendingAlert(pageReleaseIds: number[]): Promise<PendingAlert | null> {
  if (!pageReleaseIds.length) return null;
  const all = await pendingAlertsItem.getValue();
  const pending = all[pendingKey(pageReleaseIds)];
  return isPendingFresh(pending) ? pending : null;
}

export async function clearPendingAlert(releaseIds: number[]): Promise<void> {
  const all = withoutExpired(await pendingAlertsItem.getValue());
  delete all[pendingKey(releaseIds)];
  await pendingAlertsItem.setValue(all);
}

export interface EmailStatus {
  state: EmailSettingState;
  /** When this answer was read from Discogs. */
  checkedAt: number;
  /** Last attempt, successful or not, so a failing check is not retried on every page. */
  attemptedAt?: number;
  /** Read from an extension page (popup, guide), where the Discogs session may be missing. */
  fromExtension?: boolean;
}

export const emailStatusItem = storage.defineItem<EmailStatus | null>('local:emailStatus', {
  fallback: null,
});

/** Re-read the Discogs setting at most this often while browsing. */
export const EMAIL_STATUS_TTL_MS = 6 * 60 * 60 * 1000;
/** Retry delay when the last answer was "logged out" or "unknown". */
export const EMAIL_STATUS_RETRY_MS = 30 * 60 * 1000;

export const alertsSetItem = storage.defineItem<number>('local:alertsSet', { fallback: 0 });
