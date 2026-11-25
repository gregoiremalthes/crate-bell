import { parseEmailSetting } from './discogs/selectors';
import { notificationSettingsUrl } from './discogs/urls';
import { EMAIL_STATUS_RETRY_MS, EMAIL_STATUS_TTL_MS, type EmailStatus, emailStatusItem } from './store';

/**
 * Reads the user's Discogs notification settings page to see whether sale alert emails are on.
 * The request goes to discogs.com only, with the user's own session, and the answer stays local.
 */
export async function checkEmailSetting(fetchImpl: typeof fetch = fetch): Promise<EmailStatus> {
  const checkedAt = Date.now();
  let status: EmailStatus = { state: 'unknown', checkedAt };
  try {
    const response = await fetchImpl(notificationSettingsUrl(), {
      credentials: 'include',
      redirect: 'follow',
      headers: { Accept: 'text/html' },
    });
    if (response.ok && /\/login(?:[/?#]|$)/.test(new URL(response.url || 'https://x/').pathname)) {
      status = { state: 'logged-out', checkedAt };
    } else if (response.ok) {
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      status = { state: parseEmailSetting(doc), checkedAt };
    }
  } catch {
    // Offline, blocked or Discogs down: keep "unknown", the UI then simply says nothing.
  }
  const previous = await emailStatusItem.getValue();
  const settled = (state?: string) => state === 'on' || state === 'off';
  // A check made from an extension page may lack the Discogs session: never let it erase on/off.
  const fromExtensionPage = typeof location !== 'undefined' && location.protocol.endsWith('-extension:');
  const keepPrevious =
    !!previous &&
    settled(previous.state) &&
    (status.state === 'unknown' || (fromExtensionPage && !settled(status.state)));
  const next: EmailStatus = keepPrevious
    ? { ...previous, attemptedAt: checkedAt }
    : { ...status, attemptedAt: checkedAt, fromExtension: fromExtensionPage };
  await emailStatusItem.setValue(next);
  return next;
}

export async function refreshEmailStatusIfStale(): Promise<EmailStatus | null> {
  const current = await emailStatusItem.getValue();
  if (current) {
    const settled = current.state === 'on' || current.state === 'off';
    // An unsure answer from the popup is re-checked from the first Discogs page, which has the session.
    const unsureFromExtension =
      !settled && current.fromExtension && typeof location !== 'undefined' && location.protocol === 'https:';
    const last = Math.max(current.checkedAt, current.attemptedAt ?? 0);
    if (!unsureFromExtension && Date.now() - last < (settled ? EMAIL_STATUS_TTL_MS : EMAIL_STATUS_RETRY_MS)) {
      return current;
    }
  }
  return checkEmailSetting();
}
