import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Parses a fixture into its own Document, so tests never share state. */
export function fixture(name: string): Document {
  const html = readFileSync(join(__dirname, '..', 'fixtures', name), 'utf8');
  return new DOMParser().parseFromString(html, 'text/html');
}

/** Loads a fixture into the global document, for code that reads `document` directly. */
export function loadIntoDocument(name: string): void {
  const doc = fixture(name);
  document.head.innerHTML = doc.head.innerHTML;
  document.body.innerHTML = doc.body.innerHTML;
  document.title = doc.title;
}
