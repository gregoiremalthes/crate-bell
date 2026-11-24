import {
  CONDITIONS,
  type ConditionCode,
  MAX_DAILY_DIGEST_ALERTS,
  SELLER_RATING_OPTIONS,
  SHIPS_FROM_EU,
  SHIPS_FROM_OPTIONS,
} from '../discogs/constants';
import { t } from '../i18n';
import { getPrefs, type Prefs, updatePrefs } from '../store';
import { h } from '../ui/dom';

const conditionLabel = (code: ConditionCode | 'any') =>
  code === 'any' ? t('conditionAny') : (CONDITIONS.find((c) => c.code === code)?.label ?? code);

/** Saves on every change and says so, so nobody has to look for a "Save" button. */
function savedNotice(): { el: HTMLElement; flash: () => void } {
  const el = h('p', { class: 'cb-saved', role: 'status', 'aria-live': 'polite' });
  let timer = 0;
  return {
    el,
    flash: () => {
      el.textContent = t('prefsSaved');
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        el.textContent = '';
      }, 2500);
    },
  };
}

export function frequencyFieldset(prefs: Prefs, onChange: (patch: Partial<Prefs>) => void): HTMLElement {
  const option = (value: Prefs['frequency'], title: string, text: string) =>
    h(
      'label',
      { class: 'cb-choice' },
      h('input', {
        type: 'radio',
        name: 'frequency',
        value,
        checked: prefs.frequency === value,
        on: { change: () => onChange({ frequency: value }) },
      }),
      h('span', null, h('span', { class: 'cb-choice__title' }, title), h('span', { class: 'cb-choice__text' }, text)),
    );
  return h(
    'fieldset',
    { class: 'cb-choices' },
    h('legend', null, t('prefsFrequency')),
    option('realtime', t('frequencyRealtime'), t('frequencyRealtimeText')),
    option('digest', t('frequencyDigest'), t('frequencyDigestText', String(MAX_DAILY_DIGEST_ALERTS))),
  );
}

export function conditionSelect(
  id: string,
  label: string,
  value: ConditionCode | 'any',
  onChange: (value: ConditionCode | 'any') => void,
): HTMLElement {
  const codes: (ConditionCode | 'any')[] = ['any', 'M', 'NM', 'VG+', 'VG', 'G+', 'G'];
  return h(
    'div',
    { class: 'cb-field' },
    h('label', { class: 'cb-field__label', for: id }, label),
    h(
      'select',
      {
        id,
        class: 'cb-select',
        on: { change: (e) => onChange((e.target as HTMLSelectElement).value as ConditionCode | 'any') },
      },
      codes.map((code) =>
        h(
          'option',
          { value: code, selected: code === value },
          code === 'any' ? t('conditionAny') : t('conditionAtLeast', conditionLabel(code)),
        ),
      ),
    ),
  );
}

/** Short form for the popup: frequency and media condition. */
export async function mountQuickPrefs(container: HTMLElement): Promise<void> {
  const prefs = await getPrefs();
  const saved = savedNotice();
  const save = async (patch: Partial<Prefs>) => {
    await updatePrefs(patch);
    saved.flash();
  };
  container.append(
    frequencyFieldset(prefs, save),
    conditionSelect('popup-media', t('prefsMedia'), prefs.minMediaCondition, (v) => save({ minMediaCondition: v })),
    saved.el,
  );
}

/** Full form for the guide page. */
export async function mountFullPrefs(container: HTMLElement): Promise<void> {
  const prefs = await getPrefs();
  const saved = savedNotice();
  const save = async (patch: Partial<Prefs>) => {
    Object.assign(prefs, await updatePrefs(patch));
    saved.flash();
  };

  const countries = new Set(prefs.shipsFrom);
  const countryBoxes = SHIPS_FROM_OPTIONS.map((country) =>
    h(
      'label',
      { class: 'cb-check' },
      h('input', {
        type: 'checkbox',
        value: country,
        checked: countries.has(country),
        on: {
          change: (e) => {
            const box = e.target as HTMLInputElement;
            if (box.checked) countries.add(country);
            else countries.delete(country);
            void save({ shipsFrom: [...countries] });
          },
        },
      }),
      country,
    ),
  );
  const setCountries = (list: readonly string[]) => {
    countries.clear();
    for (const c of list) countries.add(c);
    for (const label of countryBoxes) {
      const box = label.querySelector('input') as HTMLInputElement;
      box.checked = countries.has(box.value);
    }
    void save({ shipsFrom: [...countries] });
  };

  const toggle = (key: keyof Prefs['features'], label: string, help: string) =>
    h(
      'label',
      { class: 'cb-choice cb-choice--soft' },
      h('input', {
        type: 'checkbox',
        checked: prefs.features[key],
        on: {
          change: (e) => save({ features: { ...prefs.features, [key]: (e.target as HTMLInputElement).checked } }),
        },
      }),
      h('span', null, h('span', { class: 'cb-choice__title' }, label), h('span', { class: 'cb-choice__text' }, help)),
    );

  container.append(
    h(
      'fieldset',
      { class: 'cb-choices', id: 'features' },
      h('legend', null, t('featuresTitle')),
      toggle('release', t('featureRelease'), t('featureReleaseText')),
      toggle('wantlist', t('featureWantlist'), t('featureWantlistText')),
      toggle('master', t('featureMaster'), t('featureMasterText')),
      toggle('guide', t('featureGuide'), t('featureGuideText')),
      h('p', { class: 'cb-small cb-muted' }, t('featuresNote')),
    ),
    frequencyFieldset(prefs, save),
    conditionSelect('pref-media', t('prefsMedia'), prefs.minMediaCondition, (v) => save({ minMediaCondition: v })),
    conditionSelect('pref-sleeve', t('prefsSleeve'), prefs.minSleeveCondition, (v) => save({ minSleeveCondition: v })),
    h(
      'label',
      { class: 'cb-check' },
      h('input', {
        type: 'checkbox',
        checked: prefs.hideGenericSleeves,
        on: { change: (e) => save({ hideGenericSleeves: (e.target as HTMLInputElement).checked }) },
      }),
      t('prefsHideGeneric'),
    ),
    h(
      'div',
      { class: 'cb-field' },
      h('label', { class: 'cb-field__label', for: 'pref-rating' }, t('prefsSellerRating')),
      h(
        'select',
        {
          id: 'pref-rating',
          class: 'cb-select',
          on: { change: (e) => save({ minSellerRating: Number((e.target as HTMLSelectElement).value) }) },
        },
        SELLER_RATING_OPTIONS.map((r) =>
          h(
            'option',
            { value: String(r), selected: r === prefs.minSellerRating },
            r === 0 ? t('ratingAny') : t('ratingAtLeast', String(r)),
          ),
        ),
      ),
    ),
    h(
      'fieldset',
      { class: 'cb-choices' },
      h('legend', null, t('prefsShipsFrom')),
      h('p', { class: 'cb-small cb-muted' }, t('prefsShipsFromHelp')),
      h(
        'div',
        { class: 'cb-chips' },
        h(
          'button',
          {
            type: 'button',
            class: 'cb-btn cb-btn--secondary cb-btn--sm',
            on: { click: () => setCountries(SHIPS_FROM_EU) },
          },
          t('prefsShipsFromEu'),
        ),
        h(
          'button',
          { type: 'button', class: 'cb-btn cb-btn--ghost cb-btn--sm', on: { click: () => setCountries([]) } },
          t('prefsShipsFromAny'),
        ),
      ),
      h('div', { class: 'cb-countries' }, countryBoxes),
    ),
    saved.el,
  );
}
