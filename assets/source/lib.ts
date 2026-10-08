import { readFileSync } from 'node:fs';
import opentype from 'opentype.js';
import type { Font, Path } from 'opentype.js';

// A raster traced by trace.ts: path data per layer, plus the size of the traced canvas.
export interface Trace {
  w: number;
  h: number;
  ink: string;
  blue: string;
}

const f = (n: number): number => +n.toFixed(2);
// opentype's toPathData emits NaN for some zero-length segments, so serialize by hand.
export function pathData(p: Path): string {
  return p.commands.map(c => c.type === 'Z' ? 'Z' : c.type === 'Q' ? `Q${f(c.x1)} ${f(c.y1)} ${f(c.x)} ${f(c.y)}`
    : c.type === 'C' ? `C${f(c.x1)} ${f(c.y1)} ${f(c.x2)} ${f(c.y2)} ${f(c.x)} ${f(c.y)}` : `${c.type}${f(c.x)} ${f(c.y)}`).join('');
}

export function loadFont(file: string): Font {
  const { buffer, byteOffset, byteLength } = readFileSync(file);
  return opentype.parse(buffer.slice(byteOffset, byteOffset + byteLength));
}

// A required command-line argument.
export function arg(value: string | undefined, usage: string): string {
  if (value === undefined) throw new Error(`usage: ${usage}`);
  return value;
}
