// Builds src/public/_locales/<lang>/messages.json from the flat files in locales/.
// Writing "$1" in a translation is enough: placeholders are generated here.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'locales';
const OUT = join('public', '_locales');
const NBSP = ' ';

/** French typography: non-breaking space before ? ! : ; and inside « ». */
const frenchSpacing = (text) =>
  text
    .replace(/ ([?!:;])/g, `${NBSP}$1`)
    .replace(/« /g, `«${NBSP}`)
    .replace(/ »/g, `${NBSP}»`)
    .replace(/(\d) %/g, `$1${NBSP}%`);

for (const file of readdirSync(SRC).filter((f) => f.endsWith('.json'))) {
  const lang = file.replace('.json', '');
  const source = JSON.parse(readFileSync(join(SRC, file), 'utf8'));
  const messages = {};
  for (const [key, raw] of Object.entries(source)) {
    let text = lang === 'fr' ? frenchSpacing(raw) : raw;
    const numbers = [...new Set([...text.matchAll(/\$(\d)/g)].map((m) => m[1]))];
    if (numbers.length) {
      text = text.replace(/\$(\d)/g, (_, n) => `$P${n}$`);
      messages[key] = {
        message: text,
        placeholders: Object.fromEntries(numbers.map((n) => [`p${n}`, { content: `$${n}` }])),
      };
    } else {
      messages[key] = { message: text };
    }
  }
  mkdirSync(join(OUT, lang), { recursive: true });
  writeFileSync(join(OUT, lang, 'messages.json'), `${JSON.stringify(messages, null, 2)}\n`);
}
console.log('Locales built.');
