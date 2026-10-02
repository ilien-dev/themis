// Cut the 3 × 2 icon sheet into six square cells: work/icon-1.png … work/icon-6.png.
import sharp from "sharp";
import { mkdirSync } from "node:fs";
mkdirSync("work", { recursive: true });
for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++)
  await sharp("raw/icons-sheet.png").extract({ left: c * 512, top: r * 512, width: 512, height: 512 }).toFile(`work/icon-${r * 3 + c + 1}.png`);
