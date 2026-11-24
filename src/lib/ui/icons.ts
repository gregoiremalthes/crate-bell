/**
 * Line icons drawn for Crate Bell in the Highlighter manner:
 * 24px grid, 1.5px stroke, round caps, no fills.
 */
const icon = (body: string, size = 24) =>
  `<svg class="cb-icon" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const ICONS = {
  bell: icon(
    '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/><path d="M12 3.5V5"/>',
  ),
  record: icon('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.5"/><circle cx="12" cy="12" r="1.25"/>'),
  check: icon('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  arrowRight: icon('<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>'),
  close: icon('<path d="M6 6l12 12"/><path d="M18 6L6 18"/>'),
  info: icon('<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7.75v.01"/>'),
  warning: icon('<path d="M12 4l9 16H3z"/><path d="M12 10v4"/><path d="M12 17v.01"/>'),
  external: icon('<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5H5V6h5"/>'),
  cup: icon(
    '<path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M8 4.5c0 1 1 1 1 2M12 4.5c0 1 1 1 1 2"/>',
  ),
  trash: icon('<path d="M5 7h14"/><path d="M10 7V5h4v2"/><path d="M7 7l1 12h8l1-12"/>'),
  mail: icon('<rect x="3.5" y="6" width="17" height="12"/><path d="M4 7l8 6 8-6"/>'),
  crate: icon(
    '<rect x="3.5" y="12" width="17" height="8"/><path d="M10 16h4"/><path d="M6 12V5h4.5v7"/><path d="M10.5 12V7.5L15 6v6"/><path d="M15 12V6.5h3.5V12"/>',
  ),
} as const;

export type IconName = keyof typeof ICONS;

/** A record with a bell: the Crate Bell mark, for the large pink Disc. */
export const RECORD_BELL_ILLUSTRATION = `<svg class="cb-illustration" viewBox="0 0 96 96" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="40" cy="56" r="28" fill="currentColor" stroke="none"/>
  <circle cx="40" cy="56" r="22" stroke="#6b6b6b" stroke-width="1.2"/>
  <circle cx="40" cy="56" r="16.5" stroke="#6b6b6b" stroke-width="1.2"/>
  <circle cx="40" cy="56" r="9" fill="#f69cc6" stroke="none"/>
  <circle cx="40" cy="56" r="1.8" fill="currentColor" stroke="none"/>
  <path d="M58 37v-9a12 12 0 0 1 24 0v9l3.5 3.5h-31z" fill="#fff" stroke-width="3"/>
  <path d="M66 44.5a4 4 0 0 0 8 0" stroke-width="3"/>
  <path d="M70 12.5v3.5" stroke-width="3"/>
</svg>`;
