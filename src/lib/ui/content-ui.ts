import { browser } from 'wxt/browser';
import { h, prefersReducedMotion, svg } from './dom';
import { ICONS, type IconName } from './icons';

/**
 * Fonts must be declared in the page document to be usable inside a shadow root.
 * Family names are prefixed so they can never clash with Discogs' own fonts.
 */
export function injectFontFaces(): void {
  if (document.getElementById('crate-bell-fonts')) return;
  const serif = browser.runtime.getURL('/fonts/fraunces-soft.woff2');
  const sans = browser.runtime.getURL('/fonts/dm-sans.woff2');
  const style = document.createElement('style');
  style.id = 'crate-bell-fonts';
  style.textContent = `
@font-face{font-family:'Crate Bell Serif';font-style:normal;font-weight:100 900;font-display:swap;src:url('${serif}') format('woff2');}
@font-face{font-family:'Crate Bell Sans';font-style:normal;font-weight:100 1000;font-display:swap;src:url('${sans}') format('woff2');}`;
  (document.head ?? document.documentElement).appendChild(style);
}

export const icon = (name: IconName): SVGElement => svg(ICONS[name]);

/**
 * A pulsing pink ring drawn over a Discogs control, to show exactly where to click.
 * It never intercepts clicks and follows the control while the page scrolls.
 */
export class Spotlight {
  private ring: HTMLDivElement;
  private label: HTMLSpanElement;
  private target: Element | null = null;
  private frame = 0;

  constructor(container: Element) {
    this.label = h('span', { class: 'cb-spotlight__label' });
    this.ring = h('div', { class: 'cb-spotlight', hidden: true, 'aria-hidden': 'true' }, this.label);
    container.appendChild(this.ring);
  }

  show(target: Element | null, labelText = '', scroll = false): void {
    if (!target) {
      this.hide();
      return;
    }
    const changed = target !== this.target;
    this.target = target;
    this.label.textContent = labelText;
    this.label.hidden = !labelText;
    this.ring.hidden = false;
    if (changed && scroll) {
      target.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
    if (!this.frame) this.tick();
  }

  hide(): void {
    this.target = null;
    this.ring.hidden = true;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  private tick = (): void => {
    if (!this.target?.isConnected) {
      this.hide();
      return;
    }
    const rect = this.target.getBoundingClientRect();
    const visible = rect.width > 0 && rect.height > 0;
    this.ring.hidden = !visible;
    if (visible) {
      Object.assign(this.ring.style, {
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      });
      const nearBottom = rect.bottom > window.innerHeight - 80;
      this.label.classList.toggle('cb-spotlight__label--above', nearBottom);
    }
    this.frame = requestAnimationFrame(this.tick);
  };

  destroy(): void {
    this.hide();
    this.ring.remove();
  }
}

/** Asks the background to open the guide page (content scripts cannot open extension pages). */
export function openGuide(section?: string): void {
  void browser.runtime.sendMessage({ type: 'open-guide', section }).catch(() => undefined);
}
