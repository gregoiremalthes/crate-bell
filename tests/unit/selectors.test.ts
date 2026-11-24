import { describe, expect, it } from 'vitest';
import {
  findEmailSettingRow,
  findMasterAddAllButton,
  findMasterAnchor,
  findOpenDrawer,
  findReleaseAnchor,
  findSavedSearchesSelect,
  findSaveSearchButton,
  findWantlistButton,
  isDefaultAlertName,
  isLoggedOut,
  isWantlisterDown,
  parseEmailSetting,
  readDrawerEmailCheckbox,
  readDrawerError,
  readMasterVersionCount,
  readRecordInfo,
  readSavedSearchNames,
  readWantlistState,
  setNativeInputValue,
} from '@/lib/discogs/selectors';
import { fixture } from './helpers';

describe('release page', () => {
  it("finds Discogs' wantlist button and reads its state", () => {
    const notIn = fixture('release-not-in-wantlist.html');
    const inList = fixture('release-in-wantlist.html');
    expect(findWantlistButton(notIn)?.textContent).toContain('Add to Wantlist');
    expect(readWantlistState(notIn)).toBe('not-in-wantlist');
    expect(readWantlistState(inList)).toBe('in-wantlist');
  });

  it('still works if Discogs translates the button, thanks to the icon', () => {
    const doc = fixture('release-in-wantlist.html');
    const button = findWantlistButton(doc);
    const label = button?.querySelector('div');
    if (label?.lastChild) label.lastChild.textContent = ' Von der Wantlist entfernen';
    expect(findWantlistButton(doc)).toBe(button);
    expect(readWantlistState(doc)).toBe('in-wantlist');
  });

  it('reports unknown when there is no wantlist button', () => {
    const doc = fixture('release-not-in-wantlist.html');
    doc.querySelector('.buttons_dip1O')?.remove();
    expect(readWantlistState(doc)).toBe('unknown');
  });

  it('places the card right after the block holding the wantlist button', () => {
    const doc = fixture('release-in-wantlist.html');
    const anchor = findReleaseAnchor(doc);
    expect(anchor?.className).toBe('wrapper_QtM84');
    expect(anchor?.parentElement?.tagName).toBe('ASIDE');
  });

  it('falls back to the statistics section', () => {
    const doc = fixture('release-not-in-wantlist.html');
    doc.querySelector('.wrapper_QtM84')?.remove();
    expect(findReleaseAnchor(doc)?.id).toBe('release-stats');
  });

  it('reads title and artists from the structured data', () => {
    expect(readRecordInfo('release', fixture('release-not-in-wantlist.html'))).toEqual({
      title: 'Homework',
      artists: ['Daft Punk'],
    });
  });

  it("falls back to the page title and drops Discogs' number suffixes", () => {
    const doc = fixture('release-not-in-wantlist.html');
    doc.querySelector('#release_schema')?.remove();
    doc.title = 'Deano (17) – Reasons – Vinyl (EP) [r123] | Discogs';
    expect(readRecordInfo('release', doc)).toEqual({ title: 'Reasons', artists: ['Deano'] });
  });

  it('detects logged-out visitors from the header login link', () => {
    const doc = fixture('release-not-in-wantlist.html');
    expect(isLoggedOut(doc)).toBe(false);
    doc.querySelector('header')?.insertAdjacentHTML('beforeend', '<a href="/login?return_to=x">Log In</a>');
    expect(isLoggedOut(doc)).toBe(true);
  });
});

describe('master page', () => {
  it('finds the anchor, the version count and the Add to Wantlist menu', () => {
    const doc = fixture('master.html');
    expect(findMasterAnchor(doc)?.id).toBe('master-statistics');
    expect(readMasterVersionCount(doc)).toBe(108);
    expect(findMasterAddAllButton(doc)?.textContent).toBe('Add to Wantlist');
    expect(readRecordInfo('master', doc)).toEqual({ title: 'Homework', artists: ['Daft Punk'] });
  });
});

describe('Items I Want page', () => {
  it('finds the save button, the saved alerts and the open drawer', () => {
    const doc = fixture('wantlister.html');
    expect(findSaveSearchButton(doc)?.textContent).toBe('Save Search');
    expect(findSavedSearchesSelect(doc)).not.toBeNull();
    expect(readSavedSearchNames(doc)).toEqual(["Champion Soul – Wha' Cha Got?", 'Seiji - Seiji5']);
    const drawer = findOpenDrawer(doc);
    expect(drawer?.getAttribute('data-slot')).toBe('sheet-content');
    expect(readDrawerEmailCheckbox(drawer as HTMLElement)).toBe(true);
    expect(readDrawerError(drawer as HTMLElement)).toBeNull();
  });

  it.each([
    ['30/30 Daily Digest notifications have been set. Manage your notification settings…', 'digest-limit'],
    ['You have exceeded the maximum number of facets allowed.', 'filter-limit'],
    ['300/300 Searches saved. Manage your saved searches to free up space before creating new ones.', 'saved-limit'],
    ['100/100 characters used.', 'name-too-long'],
    ['You already have a saved search with this name.', 'name-taken'],
  ])('explains the Discogs error "%s"', (message, expected) => {
    const drawer = findOpenDrawer(fixture('wantlister.html')) as HTMLElement;
    drawer.insertAdjacentHTML('beforeend', `<p>${message}</p>`);
    expect(readDrawerError(drawer)).toBe(expected);
  });

  it("recognises Discogs' own error screen", () => {
    const doc = fixture('wantlister.html');
    expect(isWantlisterDown(doc)).toBe(false);
    doc.body.insertAdjacentHTML('afterbegin', "<h1>Put on a record; we'll be right back.</h1>");
    expect(isWantlisterDown(doc)).toBe(true);
  });

  it('only replaces default names', () => {
    expect(isDefaultAlertName('My Saved Search 9')).toBe(true);
    expect(isDefaultAlertName('  ')).toBe(true);
    expect(isDefaultAlertName('Seiji - Seiji5')).toBe(false);
  });

  it('sets a value React will notice', () => {
    const input = document.createElement('input');
    let events = 0;
    input.addEventListener('input', () => events++);
    setNativeInputValue(input, 'Seiji - Seiji5');
    expect(input.value).toBe('Seiji - Seiji5');
    expect(events).toBe(1);
  });
});

describe('notification settings', () => {
  it('reads the saved state of the wantlist email box', () => {
    const doc = fixture('settings-notifications.html');
    expect(parseEmailSetting(doc)).toBe('on');
    expect(findEmailSettingRow(doc)?.textContent).toContain('wantlist is listed for sale');
    doc.querySelector('input[name="email"][value="5"]')?.removeAttribute('checked');
    expect(parseEmailSetting(doc)).toBe('off');
  });

  it('tells a login page apart from an unexpected page', () => {
    const login = new DOMParser().parseFromString('<form action="/login"><input name="password"></form>', 'text/html');
    expect(parseEmailSetting(login)).toBe('logged-out');
    const other = new DOMParser().parseFromString('<p>Hello</p>', 'text/html');
    expect(parseEmailSetting(other)).toBe('unknown');
  });
});

describe('saved searches menu', () => {
  it('lists the saved searches and knows when the list is complete', async () => {
    const { readSavedSearches, isSavedSearchListComplete } = await import('@/lib/discogs/selectors');
    const doc = fixture('wantlister.html');
    expect(readSavedSearches(doc)).toEqual([
      { id: '371766', name: "Champion Soul – Wha' Cha Got?" },
      { id: '383573', name: 'Seiji - Seiji5' },
    ]);
    expect(isSavedSearchListComplete(doc)).toBe(true);
    (doc.getElementById('saved-searches') as HTMLElement).textContent = '5 Saved Searches';
    expect(isSavedSearchListComplete(doc)).toBe(false);
  });

  it('opens a saved search and finds Delete, then the confirmation', async () => {
    const { selectSavedSearch, readSelectedSavedSearch, findDeleteButton, findDeleteConfirmBox } = await import(
      '@/lib/discogs/selectors'
    );
    const doc = fixture('wantlister.html');
    const select = doc.querySelector('select') as HTMLSelectElement;
    let changes = 0;
    select.addEventListener('change', () => changes++);
    expect(selectSavedSearch('383573', doc)).toBe(true);
    expect(selectSavedSearch('nope', doc)).toBe(false);
    expect(changes).toBe(1);
    expect(readSelectedSavedSearch(doc)).toEqual({ id: '383573', name: 'Seiji - Seiji5' });

    select.insertAdjacentHTML(
      'afterend',
      '<div id="actions"><button>Update Search</button><button>Delete</button></div>',
    );
    expect(findDeleteButton(doc)?.parentElement?.id).toBe('actions');
    doc
      .getElementById('actions')
      ?.insertAdjacentHTML(
        'beforeend',
        '<div id="box"><p>Are you sure you want to delete this saved search?</p><div><button>Cancel</button><button>Delete</button></div></div>',
      );
    expect(findDeleteConfirmBox(doc)?.id).toBe('box');
    expect(findDeleteButton(doc)?.closest('#box')).not.toBeNull();
  });
});

describe('wantlist page', () => {
  it('reads records in the table and card layouts', async () => {
    const { readWantlistItems } = await import('@/lib/discogs/selectors');
    const table = readWantlistItems(fixture('wantlist.html'));
    expect(table.map((i) => [i.releaseId, i.layout, i.artists, i.title])).toEqual([
      [3263269, 'table', ['Seiji'], 'Seiji5'],
      [3235, 'table', ['Daft Punk'], 'Homework'],
    ]);
    expect(table[0]?.anchor.className).toContain('artist_title');
    const cards = readWantlistItems(fixture('wantlist-cards.html'));
    expect(cards.map((i) => [i.releaseId, i.layout, i.artists, i.title])).toEqual([
      [3263269, 'card', ['Seiji'], 'Seiji5'],
    ]);
  });
});
