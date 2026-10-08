// Build the coin emblem as SVG: marble disc, ink rim, beaded ring, ΘΕΜΙΣ legend on an arc
// (text converted to outlines), and the traced portrait (ink + blue blindfold).
//   node coin.ts <trace.json> <out.svg> [legendFont]
import { readFileSync, writeFileSync } from 'node:fs';
import { arg, loadFont, pathData } from './lib.ts';
import type { Trace } from './lib.ts';

const USAGE = 'node coin.ts <trace.json> <out.svg> [legendFont]';
const [, , traceArg, outArg, fontFile = 'node_modules/@fontsource/noto-serif/files/noto-serif-greek-600-normal.woff'] = process.argv;
const [traceFile, outFile] = [arg(traceArg, USAGE), arg(outArg, USAGE)];
const t = JSON.parse(readFileSync(traceFile, 'utf8')) as Trace;
const C = 512, R = 500;                     // coin centre and radius
const COL = { marble: '#F2EEE6', ink: '#101B2D', blue: '#1D6A99' };
const f = (n: number): number => +n.toFixed(2);


// Beaded ring, like the dotted border of a drachma.
const beads: string[] = [];
const NB = 84, RB = 462;
for (let i = 0; i < NB; i++) {
  const a = (i / NB) * 2 * Math.PI;
  beads.push(`<circle cx="${f(C + RB * Math.cos(a))}" cy="${f(C + RB * Math.sin(a))}" r="7"/>`);
}

// Legend on the upper-left arc, reading clockwise, letters upright to the arc.
const font = loadFont(fontFile);
const text = 'ΘΕΜΙΣ', size = 70, track = 0.30, RL = 392;   // baseline radius
const glyphs = font.stringToGlyphs(text);
const adv = glyphs.map(g => ((g.advanceWidth ?? 0) / font.unitsPerEm) * size);
const total = adv.reduce((a, b) => a + b, 0) + track * size * (glyphs.length - 1);
const startAngle = (process.env['LA'] ? +process.env['LA'] : -50) - (total / RL) * (180 / Math.PI) / 2;  // centred 50° left of top
let s = 0;
const legend: string[] = [];
glyphs.forEach((g, i) => {
  const w = adv[i] ?? 0;
  const mid = s + w / 2;
  const ang = startAngle + (mid / RL) * (180 / Math.PI);
  const d = pathData(g.getPath(0, 0, size));
  legend.push(`<path transform="rotate(${f(ang)} ${C} ${C}) translate(${f(C - w / 2)} ${C - RL})" d="${d}"/>`);
  s += w + track * size;
});

// Portrait: the source canvas framed the head in a circle of 68% of its width.
const k = (2 * 300) / (t.w * 0.68), ox = C - (t.w / 2) * k + 28, oy = C - (t.h / 2) * k + 16;
const portrait = `<g transform="translate(${f(ox)} ${f(oy)}) scale(${k.toFixed(5)})">
<path fill="${COL.ink}" fill-rule="evenodd" d="${t.ink}"/><path fill="${COL.blue}" fill-rule="evenodd" d="${t.blue}"/></g>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024"><title>themis</title>
<circle cx="${C}" cy="${C}" r="${R}" fill="${COL.marble}"/>
<circle cx="${C}" cy="${C}" r="${R - 9}" fill="none" stroke="${COL.ink}" stroke-width="18"/>
<g fill="${COL.ink}">${beads.join('')}</g>
<circle cx="${C}" cy="${C}" r="440" fill="none" stroke="${COL.ink}" stroke-width="3"/>
<g fill="${COL.ink}">${legend.join('')}</g>
${portrait}
</svg>`;
writeFileSync(outFile, svg);
console.log(`${outFile}: ${(svg.length / 1024).toFixed(0)} KB`);
