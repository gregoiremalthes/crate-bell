import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..');
const locales = Object.fromEntries(
  ['en', 'fr', 'de'].map((lang) => [
    lang,
    JSON.parse(readFileSync(join(root, 'locales', `${lang}.json`), 'utf8')) as Record<string, string>,
  ]),
);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.(ts|html)$/.test(name) ? [path] : [];
  });
}

const usedKeys = new Set<string>();
for (const file of sourceFiles(join(root, 'src'))) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(/\bt\(\s*'([A-Za-z0-9_]+)'/g)) usedKeys.add(m[1] as string);
  for (const m of text.matchAll(/data-i18n(?:-aria-label)?="([A-Za-z0-9_]+)"/g)) usedKeys.add(m[1] as string);
}
for (const error of ['digest_limit', 'filter_limit', 'saved_limit', 'name_too_long', 'name_taken']) {
  usedKeys.add(`coachError_${error}`);
}

describe('translations', () => {
  it('has every key used in the code, in every language', () => {
    for (const [lang, messages] of Object.entries(locales)) {
      const missing = [...usedKeys].filter((key) => !(key in messages));
      expect(missing, `missing in ${lang}`).toEqual([]);
    }
  });

  it('has the same keys and the same placeholders in every language', () => {
    const en = locales.en as Record<string, string>;
    for (const [lang, messages] of Object.entries(locales)) {
      expect(Object.keys(messages).sort(), lang).toEqual(Object.keys(en).sort());
      for (const [key, text] of Object.entries(messages)) {
        const placeholders = (s: string) => [...s.matchAll(/\$\d/g)].map((m) => m[0]).sort();
        expect(placeholders(text), `${lang}.${key}`).toEqual(placeholders(en[key] as string));
      }
    }
  });

  it('follows the house style: no em dash, no exclamation mark, no emoji', () => {
    for (const [lang, messages] of Object.entries(locales)) {
      for (const [key, text] of Object.entries(messages)) {
        expect(text, `${lang}.${key}`).not.toMatch(/[—!]|\p{Extended_Pictographic}/u);
      }
    }
  });

  it('fits the Chrome Web Store limits', () => {
    for (const messages of Object.values(locales)) {
      expect((messages.extName as string).length).toBeLessThanOrEqual(75);
      expect((messages.extDescription as string).length).toBeLessThanOrEqual(132);
    }
  });
});
