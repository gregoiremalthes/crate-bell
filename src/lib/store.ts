import { storage } from 'wxt/utils/storage';
import type { EmailSettingState } from './discogs/selectors';
import { type AlertFilters, NO_FILTERS } from './discogs/urls';

/** Everything is stored locally in the browser. Nothing is ever sent anywhere. */

export type Frequency = 'realtime' | 'digest';

/** Parts of Crate Bell the user can switch off. */
export interface Features {
  /** Button and alert status on record pages. */
  release: boolean;
  /** "Any pressing" card on album (master) pages. */
  master: boolean;
  /** "Set alert" buttons and "Alert on" tags on the wantlist page. */
  wantlist: boolean;
  /** Guide panel on Discogs' "Items I Want" page. */
  guide: boolean;
}

export const DEFAULT_FEATURES: Features = { release: true, master: true, wantlist: true, guide: true };

export interface Prefs extends AlertFilters {
  features: Features;
  /** How Discogs should email: as soon as a copy is listed, or once a day. */
  frequency: Frequency;
  /** Formats picked last time on a master page. */
  masterFormats: string[];
}

export const DEFAULT_PREFS: Prefs = {
  ...NO_FILTERS,
  frequency: 'realtime',
  masterFormats: [],
  features: DEFAULT_FEATURES,
};

export const prefsItem = storage.defineItem<Prefs>('local:prefs', {
  fallback: DEFAULT_PREFS,
  version: 1,
});

export async function getPrefs(): Promise<Prefs> {
  // Merge so that preferences added in later versions get their default value.
  const saved = await prefsItem.getValue();
  return { ...DEFAULT_PREFS, ...saved, features: { ...DEFAULT_FEATURES, ...saved?.features } };
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

export function isPendingFresh<T extends { createdAt: number }>(
  pending: T | null | undefined,
  now = Date.now(),
): pending is T {
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

// ---------- Alerts Crate Bell knows about ----------

/**
 * Discogs does not say which records have an alert, so Crate Bell remembers the alerts saved
 * through it, and the ones the user opens in Discogs' "Saved Searches" menu. The list is checked
 * against that menu every time the user visits "Items I Want" (see syncKnownAlerts).
 */
export interface KnownAlert {
  name: string;
  releaseIds: number[];
  /** Discogs' id for the saved search, when seen in the menu. */
  savedSearchId?: string;
  /** "no" means the saved search sends no email. Unknown for alerts made outside Crate Bell. */
  frequency?: Frequency | 'no';
  /** When it was saved through Crate Bell. */
  savedAt?: number;
  source: 'crate-bell' | 'discogs';
}

export const knownAlertsItem = storage.defineItem<KnownAlert[]>('local:knownAlerts', { fallback: [] });

const sameAlert = (a: KnownAlert, b: { savedSearchId?: string; name: string }) =>
  (!!a.savedSearchId && a.savedSearchId === b.savedSearchId) || a.name.toLowerCase() === b.name.toLowerCase();

/** Adds or updates an alert (matched by Discogs id, then by name). */
export async function rememberAlert(alert: KnownAlert): Promise<void> {
  const all = await knownAlertsItem.getValue();
  const index = all.findIndex((a) => sameAlert(a, alert));
  if (index >= 0) {
    const previous = all[index] as KnownAlert;
    all[index] = {
      ...previous,
      ...alert,
      // What Crate Bell itself saved is more precise than what it later sees in the menu.
      frequency: alert.frequency ?? previous.frequency,
      savedAt: previous.savedAt ?? alert.savedAt,
      source: previous.source === 'crate-bell' ? 'crate-bell' : alert.source,
    };
  } else {
    all.push(alert);
  }
  await knownAlertsItem.setValue(all);
}

export async function forgetAlert(match: { savedSearchId?: string; name: string }): Promise<void> {
  const all = await knownAlertsItem.getValue();
  await knownAlertsItem.setValue(all.filter((a) => !sameAlert(a, match)));
}

/**
 * Keeps only the alerts still listed in Discogs' "Saved Searches" menu, and records their ids.
 * Call it only with the complete list (see isSavedSearchListComplete).
 */
export async function syncKnownAlerts(listed: { id: string; name: string }[]): Promise<void> {
  const all = await knownAlertsItem.getValue();
  const next: KnownAlert[] = [];
  for (const alert of all) {
    const found =
      listed.find((s) => alert.savedSearchId && s.id === alert.savedSearchId) ??
      listed.find((s) => s.name.toLowerCase() === alert.name.toLowerCase());
    if (found) next.push({ ...alert, savedSearchId: found.id, name: found.name });
  }
  if (JSON.stringify(next) !== JSON.stringify(all)) await knownAlertsItem.setValue(next);
}

export function alertsForRelease(alerts: KnownAlert[], releaseId: number): KnownAlert[] {
  return alerts.filter((a) => a.releaseIds.includes(releaseId));
}

/** Handoff from a record page to "Items I Want" when the user asks to delete an alert. */
export interface DeleteRequest {
  name: string;
  savedSearchId?: string;
  createdAt: number;
}

export const deleteRequestItem = storage.defineItem<DeleteRequest | null>('local:deleteRequest', { fallback: null });
