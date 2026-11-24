/**
 * Everything the extension knows about Discogs' page structure lives here.
 *
 * Rules of thumb (see docs/discovery.md):
 * - Prefer ids, `data-test` hooks, ARIA and form names over CSS classes.
 * - Discogs' CSS classes carry a generated suffix (`wrapper_QtM84`): only match their prefix.
 * - Never depend on a single signal for anything that decides what we show.
 */

export const SEL = {
  /** Right-hand column on release and master pages. */
  aside: 'aside',
  releaseStats: '#release-stats',
  masterStats: '#master-statistics',
  masterVersions: '#versions',
  releaseSchema: 'script#release_schema[type="application/ld+json"]',
  masterSchema: 'script#master_schema[type="application/ld+json"]',
  /** The "In Wantlist / Added just now" box shown once a release is in the wantlist. */
  inWantlistBox: '[class*="wantlist_"]',

  // Wantlister ("Items I Want") page
  saveSearchButton: '[data-test="button-save-search"]',
  savedSearchesSelect: 'select[data-test="saved-searches"]',
  drawer: '[role="dialog"][data-slot="sheet-content"]',
  drawerNameInput: '#save-search-name, [data-test="input-filter-name"]',
  drawerSaveButton: '[data-test="button-drawer-save-search"]',
  frequencyRadio: (value: string) => `input[type="radio"][name="notification-preference"][value="${value}"]`,

  savedSearchesCount: '#saved-searches',

  // Wantlist page (/mywantlist): table rows (standard and small layouts) and cards (large layout)
  wantlistRow: 'tr[class*="wantlist_r"]',
  wantlistCard: 'li.card[data-object-type="release"][data-object-id]',

  // Notification settings page
  wantlistEmailCheckbox: 'input[type="checkbox"][name="email"][value="5"]',
} as const;

/** Text Discogs shows on its "Want" toggle. Release pages stay in English in every locale today. */
const WANTLIST_BUTTON_TEXT = /\b(add to|remove from) wantlist\b/i;
const IN_WANTLIST_TEXT = /\bremove from wantlist\b/i;

/** Start of the SVG path Discogs uses for the eye (add) and minus (remove) icons. */
const EYE_ICON_PATH = 'M951 549';
const MINUS_ICON_PATH = 'M805 421';

const iconPath = (button: Element): string => button.querySelector('svg path')?.getAttribute('d')?.slice(0, 8) ?? '';

/** Finds Discogs' own "Add to Wantlist" / "Remove from Wantlist" button on a release page. */
export function findWantlistButton(root: ParentNode = document): HTMLButtonElement | null {
  const asides = [...root.querySelectorAll<HTMLElement>(SEL.aside)];
  for (const aside of asides) {
    const buttons = [...aside.querySelectorAll<HTMLButtonElement>('button')];
    const byText = buttons.find((b) => WANTLIST_BUTTON_TEXT.test(b.textContent ?? ''));
    if (byText) return byText;
    const byIcon = buttons.find((b) => {
      const d = iconPath(b);
      return d === EYE_ICON_PATH || d === MINUS_ICON_PATH;
    });
    if (byIcon) return byIcon;
  }
  return null;
}

export type WantlistState = 'in-wantlist' | 'not-in-wantlist' | 'unknown';

export function readWantlistState(root: ParentNode = document): WantlistState {
  const button = findWantlistButton(root);
  if (!button) return 'unknown';
  const text = button.textContent ?? '';
  if (IN_WANTLIST_TEXT.test(text)) return 'in-wantlist';
  if (WANTLIST_BUTTON_TEXT.test(text)) return 'not-in-wantlist';
  // Text changed (translation?): fall back to the icon, then to the "In Wantlist" box.
  const d = iconPath(button);
  if (d === MINUS_ICON_PATH) return 'in-wantlist';
  if (d === EYE_ICON_PATH) return 'not-in-wantlist';
  const aside = button.closest(SEL.aside);
  return aside?.querySelector(SEL.inWantlistBox) ? 'in-wantlist' : 'not-in-wantlist';
}

/**
 * Where our card goes on a release page: right after the block holding Discogs' wantlist
 * button (and its "In Wantlist" box), so it reads as the next step.
 */
export function findReleaseAnchor(root: ParentNode = document): Element | null {
  const button = findWantlistButton(root);
  if (button) {
    const aside = button.closest(SEL.aside);
    let node: Element | null = button;
    while (node?.parentElement && node.parentElement !== aside) node = node.parentElement;
    if (node && aside) return node;
  }
  return root.querySelector(SEL.releaseStats);
}

export function findMasterAnchor(root: ParentNode = document): Element | null {
  return root.querySelector(SEL.masterStats) ?? root.querySelector(`${SEL.aside} > section`);
}

/** Discogs shows a login link in the header only to visitors who are logged out. */
export function isLoggedOut(root: ParentNode = document): boolean {
  return [...root.querySelectorAll<HTMLAnchorElement>('header a[href]')].some((a) =>
    /\/login(?:[/?#]|$)/.test(a.getAttribute('href') ?? ''),
  );
}

export interface RecordInfo {
  title: string;
  artists: string[];
}

const stripDisambiguation = (name: string): string => name.replace(/\s*\(\d+\)$/, '').trim();

function parseJson(script: Element | null): unknown {
  if (!script?.textContent) return null;
  try {
    return JSON.parse(script.textContent);
  } catch {
    return null;
  }
}

const asArray = <T>(value: T | T[] | undefined | null): T[] =>
  value == null ? [] : Array.isArray(value) ? value : [value];

interface SchemaNode {
  '@type'?: string | string[];
  name?: string;
  byArtist?: { name?: string } | { name?: string }[];
  releaseOf?: SchemaNode;
  '@graph'?: SchemaNode[];
}

/** Title and artists, read from the page's structured data, then from the page title. */
export function readRecordInfo(kind: 'release' | 'master', root: Document = document): RecordInfo {
  const raw = parseJson(
    root.querySelector(kind === 'release' ? SEL.releaseSchema : SEL.masterSchema),
  ) as SchemaNode | null;
  let node: SchemaNode | null | undefined = raw;
  if (raw?.['@graph']) {
    node = raw['@graph'].find((n) => asArray(n['@type']).includes('MusicAlbum')) ?? raw['@graph'][0];
  }
  const title = node?.name?.trim();
  const artistSource = node?.releaseOf?.byArtist ?? node?.byArtist;
  const artists = asArray(artistSource)
    .map((a) => stripDisambiguation(a?.name ?? ''))
    .filter(Boolean);
  if (title) return { title, artists };

  // Fallback: "Artist – Title – Format [r123] | Discogs"
  const parts = root.title.split(' | ')[0]?.split(' – ') ?? [];
  return {
    title: (parts[1] ?? parts[0] ?? '').replace(/\s*\[[rm]\d+\]\s*$/, '').trim(),
    artists: parts.length > 1 ? [stripDisambiguation(parts[0] ?? '')] : [],
  };
}

/** Number of versions Discogs shows for a master ("108 versions"). */
export function readMasterVersionCount(root: ParentNode = document): number | null {
  const text = root.querySelector(SEL.masterVersions)?.textContent ?? '';
  const match = /(\d[\d,.]*)\s+versions/i.exec(text);
  return match ? Number(match[1]?.replace(/[,.]/g, '')) : null;
}

/** Discogs' "Add to Wantlist" menu above the versions list on a master page. */
export function findMasterAddAllButton(root: ParentNode = document): HTMLButtonElement | null {
  const section = root.querySelector(SEL.masterVersions);
  if (!section) return null;
  return (
    [...section.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      /add to wantlist/i.test(b.textContent ?? ''),
    ) ?? null
  );
}

// ---------- Wantlister page ----------

const visible = (el: Element | null | undefined): el is HTMLElement =>
  !!el && (el as HTMLElement).offsetParent !== null;

/** Discogs renders desktop and mobile layouts at once: pick the one on screen. */
export function findVisible<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T | null {
  const all = [...root.querySelectorAll<T>(selector)];
  return (all.find((el) => visible(el)) ?? all[0] ?? null) as T | null;
}

export const findSaveSearchButton = (root: ParentNode = document) =>
  findVisible<HTMLButtonElement>(SEL.saveSearchButton, root);

export const findSavedSearchesSelect = (root: ParentNode = document) =>
  findVisible<HTMLSelectElement>(SEL.savedSearchesSelect, root);

export function findOpenDrawer(root: ParentNode = document): HTMLElement | null {
  const input = root.querySelector(SEL.drawerNameInput);
  return (input?.closest(SEL.drawer) as HTMLElement | null) ?? null;
}

export interface SavedSearch {
  id: string;
  name: string;
}

/** The user's saved searches (alerts), as listed in Discogs' "Saved Searches" menu. */
export function readSavedSearches(root: ParentNode = document): SavedSearch[] {
  const select = findSavedSearchesSelect(root);
  if (!select) return [];
  return [...select.options].filter((o) => o.value !== '-1').map((o) => ({ id: o.value, name: o.text.trim() }));
}

export function readSavedSearchNames(root: ParentNode = document): string[] {
  return readSavedSearches(root).map((s) => s.name);
}

/**
 * True when the menu lists every saved search: its label ("9 Saved Searches") matches the
 * number of entries. Used before forgetting alerts that are no longer listed.
 */
export function isSavedSearchListComplete(root: ParentNode = document): boolean {
  const select = findSavedSearchesSelect(root);
  if (!select) return false;
  const labelId = select.getAttribute('aria-labelledby');
  const label = labelId ? root.querySelector(`#${CSS.escape(labelId)}`) : root.querySelector(SEL.savedSearchesCount);
  const match = /(\d+)/.exec(label?.textContent ?? '');
  return !!match && Number(match[1]) === readSavedSearches(root).length;
}

/** The saved search currently loaded in the menu, if any. */
export function readSelectedSavedSearch(root: ParentNode = document): SavedSearch | null {
  const select = findSavedSearchesSelect(root);
  const option = select?.selectedOptions[0];
  if (!select || !option || option.value === '-1') return null;
  return { id: option.value, name: option.text.trim() };
}

/** Loads a saved search, as if the user picked it in the menu (only changes what is shown). */
export function selectSavedSearch(id: string, root: ParentNode = document): boolean {
  const select = findSavedSearchesSelect(root);
  if (!select || ![...select.options].some((o) => o.value === id)) return false;
  if (select.value === id) return true;
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  if (setter) setter.call(select, id);
  else select.value = id;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

/** A button by its label, preferring the one on screen (Discogs renders two layouts at once). */
function buttonByText(root: ParentNode, text: RegExp): HTMLButtonElement | null {
  const all = [...root.querySelectorAll<HTMLButtonElement>('button')].filter((b) =>
    text.test((b.textContent ?? '').trim()),
  );
  return all.find((b) => b.offsetParent !== null) ?? all[0] ?? null;
}

/** Discogs' confirmation box after "Delete": "Are you sure you want to delete this saved search?" */
export function findDeleteConfirmBox(root: ParentNode = document): HTMLElement | null {
  const text = [...root.querySelectorAll('p')].find((p) =>
    /are you sure you want to delete this saved search/i.test(p.textContent ?? ''),
  );
  return (text?.parentElement as HTMLElement | null) ?? null;
}

/** The "Delete" button under the Saved Searches menu, or the one inside the confirmation box. */
export function findDeleteButton(root: ParentNode = document): HTMLButtonElement | null {
  const box = findDeleteConfirmBox(root);
  if (box) return buttonByText(box, /^delete$/i);
  const select = findSavedSearchesSelect(root);
  const scope = select?.closest('aside, [data-test="desktop-layout"]') ?? root;
  return buttonByText(scope, /^delete$/i);
}

/** Discogs' own error screen ("Put on a record; we'll be right back."). */
export function isWantlisterDown(root: ParentNode = document): boolean {
  return [...root.querySelectorAll('h1')].some((h) => /put on a record/i.test(h.textContent ?? ''));
}

export type DrawerError = 'digest-limit' | 'filter-limit' | 'saved-limit' | 'name-too-long' | 'name-taken';

/** Maps the error text Discogs shows in the save drawer to something we can explain. */
export function readDrawerError(drawer: ParentNode): DrawerError | null {
  const text = (drawer as HTMLElement).textContent ?? '';
  if (/Daily Digest notifications have been set/i.test(text)) return 'digest-limit';
  if (/maximum number of facets/i.test(text)) return 'filter-limit';
  if (/Searches saved\. Manage your saved searches/i.test(text)) return 'saved-limit';
  if (/characters used/i.test(text)) return 'name-too-long';
  if (/already have a saved search with this name/i.test(text)) return 'name-taken';
  return null;
}

/** The greyed "Personal email" box in the drawer mirrors the global email setting. */
export function readDrawerEmailCheckbox(drawer: ParentNode): boolean | null {
  const box = drawer.querySelector<HTMLInputElement>('input[type="checkbox"]');
  return box ? box.checked : null;
}

/**
 * Sets a value on an input controlled by React. Assigning `.value` alone is ignored by React,
 * so we go through the native setter and fire the events React listens to.
 */
export function setNativeInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (setter) setter.call(input, value);
  else input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Default names look like "My Saved Search 9": we only replace those, never the user's own text. */
export const isDefaultAlertName = (value: string): boolean =>
  value.trim() === '' || /^my saved search \d+$/i.test(value.trim());

// ---------- Notification settings page ----------

export type EmailSettingState = 'on' | 'off' | 'logged-out' | 'unknown';

/** Reads the "When a release in my wantlist is listed for sale" email box from the settings HTML. */
export function parseEmailSetting(doc: ParentNode): EmailSettingState {
  const box = doc.querySelector<HTMLInputElement>(SEL.wantlistEmailCheckbox);
  // defaultChecked is the saved value: on the live page the user may have ticked it without saving.
  if (box) return box.defaultChecked || box.hasAttribute('checked') ? 'on' : 'off';
  const hasLoginForm = !!doc.querySelector('form[action*="login"], input[name="password"], #login');
  return hasLoginForm ? 'logged-out' : 'unknown';
}

// ---------- Wantlist page (/mywantlist) ----------

export interface WantlistItem {
  element: HTMLElement;
  releaseId: number;
  layout: 'table' | 'card';
  /** Where our small control goes inside the row or card. */
  anchor: HTMLElement;
  artists: string[];
  title: string;
}

/** Every record listed on the wantlist page, in the table and card layouts. */
export function readWantlistItems(root: ParentNode = document): WantlistItem[] {
  const items: WantlistItem[] = [];
  for (const row of root.querySelectorAll<HTMLElement>(SEL.wantlistRow)) {
    const id = Number(/wantlist_r(\d+)/.exec(row.className)?.[1]);
    const anchor = row.querySelector<HTMLElement>('td.artist_title');
    if (!id || !anchor) continue;
    items.push({
      element: row,
      releaseId: id,
      layout: 'table',
      anchor,
      artists: [...anchor.querySelectorAll('.release_title a[href*="/artist/"]')].map((a) =>
        stripDisambiguation(a.textContent ?? ''),
      ),
      title: anchor.querySelector('.release_title_link a')?.textContent?.trim() ?? '',
    });
  }
  for (const card of root.querySelectorAll<HTMLElement>(SEL.wantlistCard)) {
    const id = Number(card.dataset.objectId);
    if (!id) continue;
    items.push({
      element: card,
      releaseId: id,
      layout: 'card',
      anchor: card,
      artists: [...card.querySelectorAll('.card-artist-name a')].map((a) => stripDisambiguation(a.textContent ?? '')),
      title: card.querySelector('a.search_result_title')?.textContent?.trim() ?? '',
    });
  }
  return items;
}

export function findEmailSettingRow(root: ParentNode = document): HTMLTableRowElement | null {
  return root.querySelector(SEL.wantlistEmailCheckbox)?.closest('tr') ?? null;
}
