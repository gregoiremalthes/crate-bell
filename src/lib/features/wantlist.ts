import { browser } from 'wxt/browser';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { buildAlertName } from '../alert-name';
import { readWantlistItems, type WantlistItem } from '../discogs/selectors';
import { buildWantlisterUrl } from '../discogs/urls';
import { t } from '../i18n';
import { alertsForRelease, getPrefs, type KnownAlert, knownAlertsItem, savePendingAlert } from '../store';
import { icon } from '../ui/content-ui';
import { h, onDomChange, replaceChildren } from '../ui/dom';

const HOST_TAG = 'crate-bell-row';
const ISOLATED_EVENTS = ['click', 'mousedown', 'mouseup', 'keydown', 'keyup', 'keypress'];

/**
 * On the wantlist page (/mywantlist): a small "Set alert" button on every record, or an
 * "Alert on" tag when Crate Bell knows an alert covers it.
 */
export async function initWantlistPage(ctx: ContentScriptContext): Promise<void> {
  // One stylesheet shared by every row (25 to 250 per page).
  const getUrl = browser.runtime.getURL as (path: string) => string;
  const css = await fetch(getUrl('/content-scripts/discogs.css')).then((r) => r.text());
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(`:host{all:initial;display:block}${css.replaceAll(':root', ':host')}`);

  let alerts: KnownAlert[] = (await knownAlertsItem.getValue()) ?? [];
  const mounted = new Map<HTMLElement, { item: WantlistItem; root: HTMLElement }>();

  const renderItem = (item: WantlistItem, root: HTMLElement) => {
    const alert = alertsForRelease(alerts, item.releaseId)[0];
    root.className = `cb-root cb-row${item.layout === 'card' ? ' cb-row--card' : ''}`;
    if (alert) {
      replaceChildren(root, h('span', { class: 'cb-tag', title: alert.name }, icon('bell'), t('wantlistAlertOn')));
      return;
    }
    replaceChildren(
      root,
      h(
        'button',
        {
          type: 'button',
          class: 'cb-btn cb-btn--secondary',
          'aria-label': t('wantlistSetAlertFor', item.title || String(item.releaseId)),
          on: { click: () => void openAlertPage(item) },
        },
        icon('bell'),
        t('wantlistSetAlert'),
      ),
    );
  };

  const mountAll = () => {
    for (const item of readWantlistItems()) {
      if (mounted.has(item.element) && item.anchor.querySelector(HOST_TAG)) continue;
      const host = document.createElement(HOST_TAG);
      // Discogs opens the record when its cell is clicked, and has keyboard shortcuts: keep ours to us.
      for (const type of ISOLATED_EVENTS) host.addEventListener(type, (e) => e.stopPropagation());
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.adoptedStyleSheets = [sheet];
      const root = h('div');
      shadow.appendChild(root);
      item.anchor.appendChild(host);
      mounted.set(item.element, { item, root });
      renderItem(item, root);
    }
  };

  mountAll();
  const stopDom = onDomChange(mountAll, document.getElementById('page') ?? document.body);
  const unwatch = knownAlertsItem.watch((next) => {
    alerts = next ?? [];
    for (const { item, root } of mounted.values()) renderItem(item, root);
  });
  ctx.onInvalidated(() => {
    stopDom();
    unwatch();
    for (const host of document.querySelectorAll(HOST_TAG)) host.remove();
  });
}

async function openAlertPage(item: WantlistItem): Promise<void> {
  const prefs = await getPrefs();
  const { url, releaseIds } = buildWantlisterUrl([item.releaseId], prefs);
  await savePendingAlert({
    kind: 'release',
    releaseIds,
    name: buildAlertName(item.artists, item.title),
    frequency: prefs.frequency,
    createdAt: Date.now(),
  });
  window.location.assign(url);
}
