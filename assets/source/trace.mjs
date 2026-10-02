// Split a raster into an ink layer and a blue (accent) layer, trace each with potrace,
// and write a JSON of path data plus the source size.
//   node trace.mjs <in.png> <out.json> [scale=2] [turd=6]
import sharp from "sharp";
import potrace from "potrace";
import { writeFileSync } from "node:fs";
import { promisify } from "node:util";

const [, , input, output, scaleArg = "2", turdArg = "6"] = process.argv;
const scale = Number(scaleArg);
const trace = promisify(potrace.trace);

const img = sharp(input).removeAlpha();
const { width, height } = await img.metadata();
const W = Math.round(width * scale), H = Math.round(height * scale);
const { data } = await img.resize(W, H, { kernel: "lanczos3" }).raw().toBuffer({ resolveWithObject: true });

const ink = Buffer.alloc(W * H), blue = Buffer.alloc(W * H);
for (let i = 0, p = 0; i < W * H; i++, p += 3) {
  const r = data[p], g = data[p + 1], b = data[p + 2];
  const isBlue = b - r > 45 && b > 90;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  blue[i] = isBlue ? 0 : 255;                 // potrace traces dark pixels
  ink[i] = !isBlue && lum < 135 ? 0 : 255;
}
async function layer(buf) {
  const png = await sharp(buf, { raw: { width: W, height: H, channels: 1 } }).png().toBuffer();
  const svg = await trace(png, { threshold: 128, turdSize: Number(turdArg), optTolerance: 0.4, alphaMax: 1.0 });
  return [...svg.matchAll(/ d="([^"]+)"/g)].map(m => m[1]).join(" ");
}
const out = { w: W, h: H, ink: await layer(ink), blue: await layer(blue) };
writeFileSync(output, JSON.stringify(out));
console.log(`${input}: ${W}x${H}, ink ${(out.ink.length / 1024).toFixed(0)} KB, blue ${(out.blue.length / 1024).toFixed(0)} KB`);
