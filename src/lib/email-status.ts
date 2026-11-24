import { parseEmailSetting } from './discogs/selectors';
import { notificationSettingsUrl } from './discogs/urls';
import { EMAIL_STATUS_TTL_MS, type EmailStatus, emailStatusItem } from './store';

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
  // Never overwrite a known answer with "unknown".
  const previous = await emailStatusItem.getValue();
  if (status.state !== 'unknown' || !previous) await emailStatusItem.setValue(status);
  return status.state === 'unknown' && previous ? previous : status;
}

export async function refreshEmailStatusIfStale(): Promise<EmailStatus | null> {
  const current = await emailStatusItem.getValue();
  if (current && Date.now() - current.checkedAt < EMAIL_STATUS_TTL_MS && current.state !== 'unknown') {
    return current;
  }
  return checkEmailSetting();
}
