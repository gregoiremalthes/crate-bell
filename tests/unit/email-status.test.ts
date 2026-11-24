import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { checkEmailSetting } from '@/lib/email-status';
import { emailStatusItem } from '@/lib/store';

const settingsHtml = readFileSync(join(__dirname, '..', 'fixtures', 'settings-notifications.html'), 'utf8');

const respond = (body: string, url = 'https://www.discogs.com/settings/notifications', status = 200) => {
  const response = new Response(body, { status });
  Object.defineProperty(response, 'url', { value: url });
  return vi.fn(async () => response) as unknown as typeof fetch;
};

describe('checkEmailSetting', () => {
  beforeEach(() => fakeBrowser.reset());

  it('reads "on" and stores it', async () => {
    expect((await checkEmailSetting(respond(settingsHtml))).state).toBe('on');
    expect((await emailStatusItem.getValue())?.state).toBe('on');
  });

  it('reads "off"', async () => {
    const off = settingsHtml
      .replace('value="5" aria-label', 'value="5" data-x aria-label')
      .replace(/(value="5"[^>]*?) checked="checked"/, '$1');
    expect((await checkEmailSetting(respond(off))).state).toBe('off');
  });

  it('notices a redirect to the login page', async () => {
    expect((await checkEmailSetting(respond('<html></html>', 'https://www.discogs.com/login?return_to=x'))).state).toBe(
      'logged-out',
    );
  });

  it('keeps the last known answer when Discogs cannot be reached', async () => {
    await emailStatusItem.setValue({ state: 'on', checkedAt: 1 });
    const failing = vi.fn(async () => {
      throw new TypeError('offline');
    }) as unknown as typeof fetch;
    expect((await checkEmailSetting(failing)).state).toBe('on');
    expect((await emailStatusItem.getValue())?.state).toBe('on');
  });
});

describe('refreshEmailStatusIfStale', () => {
  beforeEach(() => fakeBrowser.reset());

  it('trusts a recent on/off answer, but re-checks a "logged-out" one', async () => {
    const { refreshEmailStatusIfStale } = await import('@/lib/email-status');
    await emailStatusItem.setValue({ state: 'on', checkedAt: Date.now() });
    const spy = vi.spyOn(globalThis, 'fetch');
    expect((await refreshEmailStatusIfStale())?.state).toBe('on');
    expect(spy).not.toHaveBeenCalled();

    await emailStatusItem.setValue({ state: 'logged-out', checkedAt: Date.now() });
    spy.mockResolvedValue(new Response(settingsHtml));
    await refreshEmailStatusIfStale();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
