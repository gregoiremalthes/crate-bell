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
