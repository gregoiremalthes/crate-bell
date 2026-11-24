import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  DEFAULT_PREFS,
  getPrefs,
  isPendingFresh,
  PENDING_TTL_MS,
  type PendingAlert,
  pendingMatchesPage,
  prefsItem,
  updatePrefs,
} from '@/lib/store';

describe('preferences', () => {
  beforeEach(() => fakeBrowser.reset());

  it('starts from the defaults: realtime emails, no filters', async () => {
    expect(await getPrefs()).toEqual(DEFAULT_PREFS);
    expect(DEFAULT_PREFS.frequency).toBe('realtime');
  });

  it('saves changes and fills in preferences added later', async () => {
    await updatePrefs({ frequency: 'digest' });
    expect((await getPrefs()).frequency).toBe('digest');
    // Simulate a value saved by an older version without the newer fields.
    await prefsItem.setValue({ frequency: 'digest' } as never);
    expect((await getPrefs()).shipsFrom).toEqual([]);
  });
});

describe('pending alert handoff', () => {
  const pending: PendingAlert = {
    kind: 'release',
    releaseIds: [5, 7],
    name: 'x',
    frequency: 'realtime',
    createdAt: 1_000,
  };

  it('expires after a few minutes', () => {
    expect(isPendingFresh(pending, 1_000 + PENDING_TTL_MS - 1)).toBe(true);
    expect(isPendingFresh(pending, 1_000 + PENDING_TTL_MS)).toBe(false);
    expect(isPendingFresh(null)).toBe(false);
  });

  it('only matches the page it was meant for', () => {
    expect(pendingMatchesPage(pending, [7, 5])).toBe(true);
    expect(pendingMatchesPage(pending, [5])).toBe(false);
    expect(pendingMatchesPage(pending, [])).toBe(false);
  });
});

describe('pending alerts per record', () => {
  beforeEach(() => fakeBrowser.reset());

  it('keeps one pending alert per set of releases, and clears only its own', async () => {
    const { savePendingAlert, findPendingAlert, clearPendingAlert } = await import('@/lib/store');
    const a: PendingAlert = {
      kind: 'release',
      releaseIds: [1],
      name: 'A',
      frequency: 'realtime',
      createdAt: Date.now(),
    };
    const b: PendingAlert = {
      kind: 'master',
      releaseIds: [3, 2],
      name: 'B',
      frequency: 'digest',
      createdAt: Date.now(),
    };
    await savePendingAlert(a);
    await savePendingAlert(b);
    expect((await findPendingAlert([1]))?.name).toBe('A');
    expect((await findPendingAlert([2, 3]))?.name).toBe('B');
    await clearPendingAlert([1]);
    expect(await findPendingAlert([1])).toBeNull();
    expect((await findPendingAlert([3, 2]))?.name).toBe('B');
  });

  it('ignores expired ones', async () => {
    const { savePendingAlert, findPendingAlert } = await import('@/lib/store');
    await savePendingAlert({ kind: 'release', releaseIds: [9], name: 'old', frequency: 'realtime', createdAt: 0 });
    expect(await findPendingAlert([9])).toBeNull();
  });
});

describe('known alerts', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    const { knownAlertsItem } = await import('@/lib/store');
    await knownAlertsItem.setValue([]);
  });

  it('remembers, updates by id or name, and keeps what Crate Bell saved', async () => {
    const { rememberAlert, knownAlertsItem, alertsForRelease } = await import('@/lib/store');
    await rememberAlert({
      name: 'Seiji - Seiji5',
      releaseIds: [1],
      frequency: 'realtime',
      savedAt: 5,
      source: 'crate-bell',
    });
    // Later seen in Discogs' menu: gains its id, keeps frequency, date and source.
    await rememberAlert({ name: 'seiji - seiji5', savedSearchId: '42', releaseIds: [1], source: 'discogs' });
    const [alert] = await knownAlertsItem.getValue();
    expect(alert).toMatchObject({ savedSearchId: '42', frequency: 'realtime', savedAt: 5, source: 'crate-bell' });
    expect(alertsForRelease(await knownAlertsItem.getValue(), 1)).toHaveLength(1);
    expect(alertsForRelease(await knownAlertsItem.getValue(), 2)).toHaveLength(0);
  });

  it("follows Discogs' menu: forgets deleted alerts, follows renamed ones by id", async () => {
    const { rememberAlert, knownAlertsItem, syncKnownAlerts } = await import('@/lib/store');
    await rememberAlert({ name: 'Kept', savedSearchId: '1', releaseIds: [1], source: 'crate-bell' });
    await rememberAlert({ name: 'Renamed', savedSearchId: '2', releaseIds: [2], source: 'crate-bell' });
    await rememberAlert({ name: 'Deleted', releaseIds: [3], source: 'crate-bell' });
    await syncKnownAlerts([
      { id: '1', name: 'Kept' },
      { id: '2', name: 'New name' },
    ]);
    expect((await knownAlertsItem.getValue()).map((a) => a.name)).toEqual(['Kept', 'New name']);
  });

  it('forgets one alert', async () => {
    const { rememberAlert, knownAlertsItem, forgetAlert } = await import('@/lib/store');
    await rememberAlert({ name: 'A', releaseIds: [1], source: 'crate-bell' });
    await rememberAlert({ name: 'B', savedSearchId: '9', releaseIds: [2], source: 'discogs' });
    await forgetAlert({ name: 'whatever', savedSearchId: '9' });
    expect((await knownAlertsItem.getValue()).map((a) => a.name)).toEqual(['A']);
  });
});
