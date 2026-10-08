// Assemble every brand file from the traced layers: coin emblem, companion symbol,
// horizontal lockups, favicons and the social preview.
//   node build.mjs [outDir=..] [markVariant=1]   (after trace.mjs and coin.mjs, see ../README.md)
import opentype from "opentype.js";
import { Resvg } from "@resvg/resvg-js";
import { optimize } from "svgo";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathData } from "./lib.mjs";

const [, , OUT = "..", MARK = "1"] = process.argv;
const W = "work";
const P = {
  marble: "#F2EEE6", night: "#101B2D", aegean: "#1D6A99", aegeanLight: "#5BB0DD",
  ground: "#0C1420", stone: "#5F6673", stoneDark: "#8B93A1", inkDark: "#ECE6DA",
};
const f = (n) => +(+n).toFixed(2);
const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const font = (p) => opentype.parse(readFileSync(p).buffer);
const FONT = {
  cinzel: font("node_modules/@fontsource/cinzel/files/cinzel-latin-600-normal.woff"),
  mono: font("node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff"),
  monoMed: font("node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff"),
};

// Text as outlines, with letter spacing in em. Returns {d, width}.
function text(fnt, str, size, x, y, tracking = 0) {
  let pen = x, parts = [];
  for (const g of fnt.stringToGlyphs(str)) {
    parts.push(pathData(g.getPath(pen, y, size)));
    pen += (g.advanceWidth / fnt.unitsPerEm) * size + tracking * size;
  }
  return { d: parts.join(""), width: pen - x - tracking * size };
}

function bbox(layers, w, h) {
  const body = layers.filter(Boolean).map(d => `<path d="${d}"/>`).join("");
  const b = new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`).getBBox();
  return { x: b.x, y: b.y, w: b.width, h: b.height };
}
// Fit traced layers into a box (cx, cy, size) keeping aspect ratio; returns a <g>.
function fit(t, cx, cy, size, fills) {
  const b = bbox([t.ink, t.blue], t.w, t.h);
  const k = size / Math.max(b.w, b.h);
  const tx = cx - (b.x + b.w / 2) * k, ty = cy - (b.y + b.h / 2) * k;
  const layers = [[t.ink, fills.ink], [t.blue, fills.blue]].filter(([d, c]) => d && c)
    .map(([d, c]) => `<path fill="${c}" fill-rule="evenodd" d="${d}"/>`).join("");
  return `<g transform="translate(${f(tx)} ${f(ty)}) scale(${k.toFixed(5)})">${layers}</g>`;
}

const svgDoc = (w, h, title, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><title>${title}</title>${body}</svg>`;
function save(name, svg) {
  const min = optimize(svg, { multipass: true, floatPrecision: 1, plugins: ["preset-default"] }).data;
  writeFileSync(join(OUT, name), min);
  return min;
}
function png(name, svg, width, background) {
  const r = new Resvg(svg, { fitTo: { mode: "width", value: width }, background, font: { loadSystemFonts: false } });
  writeFileSync(join(OUT, name), r.render().asPng());
}

// 1. Coin emblem (one version: a marble disc reads on both grounds).
const coinSvg = readFileSync(join(W, "coin.svg"), "utf8");
const coinBody = coinSvg.replace(/^<svg[^>]*>(<title>[^<]*<\/title>)?/, "").replace(/<\/svg>\s*$/, "");
const emblem = save("themis-emblem.svg", svgDoc(1024, 1024, "themis", coinBody));
png("themis-emblem.png", emblem, 1024);

// 2. Companion symbol: marble disc, ink ring, solid silhouette with the blue blindfold.
const mark = json(join(W, `mark-${MARK}.json`));
const symbolBody = `<circle cx="256" cy="256" r="250" fill="${P.marble}"/><circle cx="256" cy="256" r="236" fill="none" stroke="${P.night}" stroke-width="16"/>`
  + fit(mark, 262, 262, 330, { ink: P.night, blue: P.aegean });
const symbol = save("themis-symbol.svg", svgDoc(512, 512, "themis", symbolBody));
for (const s of [512, 180, 32]) png(`themis-symbol-${s}.png`, symbol, s);

// 3. Horizontal lockups: coin, wordmark, tagline.
function lockup(theme) {
  const ink = theme === "light" ? P.night : P.inkDark;
  const accent = theme === "light" ? P.aegean : P.aegeanLight;
  const H = 300, coin = `<g transform="translate(10 10) scale(${(280 / 1024).toFixed(5)})">${coinBody}</g>`;
  const word = text(FONT.cinzel, "THEMIS", 132, 330, 178, 0.12);
  const tag = text(FONT.mono, "Two files, one text.", 31, 336, 238, 0.02);
  const w = Math.ceil(Math.max(330 + word.width, 336 + tag.width) + 12);
  return svgDoc(w, H, "themis", coin + `<path fill="${ink}" d="${word.d}"/><path fill="${accent}" d="${tag.d}"/>`);
}
for (const theme of ["light", "dark"]) {
  const s = save(`themis-${theme}.svg`, lockup(theme));
  png(`themis-${theme}.png`, s, 1400);
}

// 4. Social preview, 1280 × 640, on the night ground.
{
  const coin = `<g transform="translate(70 100) scale(${(440 / 1024).toFixed(5)})">${coinBody}</g>`;
  const word = text(FONT.cinzel, "THEMIS", 118, 584, 280, 0.12);
  const tag = text(FONT.mono, "Two files, one text.", 32, 588, 345, 0.02);
  const flow = text(FONT.monoMed, "CLAUDE.md  =  AGENTS.md", 24, 586, 460, 0.18);
  const sub = text(FONT.mono, "A Claude Code plugin for the rule files", 24, 586, 505, 0.02);
  const body = `<rect width="1280" height="640" fill="${P.ground}"/>${coin}`
    + `<path fill="${P.inkDark}" d="${word.d}"/><path fill="${P.aegeanLight}" d="${tag.d}"/>`
    + `<path fill="${P.stoneDark}" d="${flow.d}"/><path fill="${P.stoneDark}" d="${sub.d}"/>`;
  const s = save("themis-social.svg", svgDoc(1280, 640, "themis", body));
  png("themis-social.png", s, 1280);
}
console.log("done");
