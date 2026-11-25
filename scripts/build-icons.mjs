// Renders the extension icons from the SVG sources in assets/.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const OUT = 'public/icon';
mkdirSync(OUT, { recursive: true });

const render = (svgPath, size) =>
  new Resvg(readFileSync(svgPath, 'utf8'), { fitTo: { mode: 'width', value: size } }).render().asPng();

for (const size of [16, 32]) writeFileSync(`${OUT}/${size}.png`, render('assets/icon-small.svg', size));
for (const size of [48, 96, 128]) writeFileSync(`${OUT}/${size}.png`, render('assets/icon.svg', size));
console.log('Icons written to', OUT);
