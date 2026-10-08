// Rasterize an SVG to PNG at a given width.   node render.ts <in.svg> <out.png> [width=1024] [background]
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { arg } from './lib.ts';

const USAGE = 'node render.ts <in.svg> <out.png> [width=1024] [background]';
const [, , input, output, width = '1024', background] = process.argv;
const r = new Resvg(readFileSync(arg(input, USAGE), 'utf8'), { fitTo: { mode: 'width', value: Number(width) }, ...(background === undefined ? {} : { background }) });
writeFileSync(arg(output, USAGE), r.render().asPng());
