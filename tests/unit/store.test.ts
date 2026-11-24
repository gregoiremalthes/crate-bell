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
