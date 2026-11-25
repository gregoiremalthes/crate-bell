import { browser } from 'wxt/browser';

/**
 * Translations live in src/public/_locales/{en,fr,de}/messages.json.
 * The language follows the browser, like every Chrome extension.
 * A unit test checks that every key used in the code exists in every language.
 */
export type MessageKey = Parameters<typeof browser.i18n.getMessage>[0];

export function t(key: MessageKey, substitutions?: string | string[]): string {
  try {
    const message = browser.i18n.getMessage(key, substitutions);
    if (message) return message;
  } catch {
    // Extension context gone (extension reloaded while the page stayed open): fall through.
  }
  return key;
}

/** Fills the elements of a static extension page that carry a data-i18n attribute. */
export function translatePage(root: ParentNode = document): void {
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n]')) {
    el.textContent = t((el.dataset.i18n ?? '') as MessageKey);
  }
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-aria-label]')) {
    el.setAttribute('aria-label', t((el.dataset.i18nAriaLabel ?? '') as MessageKey));
  }
  // The language of the text actually shown (a Spanish browser gets the English text, lang "en").
  document.documentElement.lang = t('lang');
}
