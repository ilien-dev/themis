// Rasterize an SVG to PNG at a given width.   node render.mjs <in.svg> <out.png> [width=1024] [background]
import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";
const [, , input, output, width = "1024", background] = process.argv;
const r = new Resvg(readFileSync(input, "utf8"), { fitTo: { mode: "width", value: Number(width) }, background });
writeFileSync(output, r.render().asPng());
