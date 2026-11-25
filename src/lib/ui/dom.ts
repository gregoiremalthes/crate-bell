/**
 * A tiny DOM builder. No framework: the UI is small, and plain DOM keeps the extension
 * light, fast to review for the Chrome Web Store and free of runtime dependencies.
 * Text always goes through textContent, never innerHTML.
 */

type Child = Node | string | null | undefined | false;
type Props = Record<string, unknown> & {
  class?: string;
  on?: Partial<Record<keyof HTMLElementEventMap, (event: Event) => void>>;
};

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props | null = null,
  ...children: (Child | Child[])[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value === undefined || value === null || value === false) continue;
      if (key === 'on') {
        for (const [event, handler] of Object.entries((value as Props['on']) ?? {})) {
          el.addEventListener(event, handler as EventListener);
        }
      } else if (key === 'class') {
        el.className = String(value);
      } else if (key === 'dataset') {
        Object.assign(el.dataset, value);
      } else if (value === true) {
        el.setAttribute(key, '');
      } else {
        el.setAttribute(key, String(value));
      }
    }
  }
  append(el, children);
  return el;
}

function append(parent: Node, children: (Child | Child[])[]): void {
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    parent.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
}

/** Parses one of our own static SVG strings (never user or page content). */
export function svg(markup: string): SVGElement {
  const template = document.createElement('template');
  template.innerHTML = markup.trim();
  return template.content.firstElementChild as SVGElement;
}

export function replaceChildren(parent: Element, ...children: (Child | Child[])[]): void {
  parent.replaceChildren();
  append(parent, children);
}

/** Resolves when `test` returns a truthy value, checking on every DOM change. */
export function waitFor<T>(test: () => T | null | undefined | false, timeoutMs: number): Promise<T | null> {
  return new Promise((resolve) => {
    const first = test();
    if (first) return resolve(first);
    let done = false;
    const finish = (value: T | null) => {
      if (done) return;
      done = true;
      observer.disconnect();
      clearTimeout(timer);
      resolve(value);
    };
    const observer = new MutationObserver(() => {
      const value = test();
      if (value) finish(value);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    const timer = setTimeout(() => finish(test() || null), timeoutMs);
  });
}

/** Calls `fn` at most once per animation frame, however many DOM changes happen. */
export function onDomChange(fn: () => void, target: Node = document.body): () => void {
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      fn();
    });
  });
  observer.observe(target, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['data-state', 'class', 'aria-expanded', 'open'],
  });
  return () => observer.disconnect();
}

export const prefersReducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Re-renders `container` and puts keyboard focus back on the control that had it
 * (matched by its data-focus-key), so keyboard and screen reader users never lose their place.
 */
export function renderKeepingFocus(container: Element, render: () => void): void {
  const root = container.getRootNode() as Document | ShadowRoot;
  const active = root.activeElement as HTMLElement | null;
  const key = active && container.contains(active) ? active.dataset.focusKey : undefined;
  render();
  if (key) container.querySelector<HTMLElement>(`[data-focus-key="${CSS.escape(key)}"]`)?.focus();
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
