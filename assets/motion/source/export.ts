// Renders every scene in scenes.html to a GIF in assets/motion/, once on GitHub's
// dark ground and once on its light one. Adapted from muninn's exporter.
//
//   npm install && npx playwright install chromium
//   node export.ts                  # every scene
//   node export.ts hero parity      # only these
//   node export.ts --poster         # one PNG per scene at its poster frame, for review
//
// Each scene is a function of time, so a frame is drawn by setting t and taking a
// screenshot; nothing depends on the machine's speed. The GIF starts at the scene's
// poster frame, so a reader with autoplay off still sees a frame that tells the story.
// Frames are flat colours, so the GIF uses a full 256-colour palette and no dithering.
// Needs ffmpeg on PATH. CHROME_PATH picks a local Chromium.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// What scenes.html exposes to the exporter.
interface Scene { w: number; h: number; dur: number; poster: number }
interface ThemisMotion {
  scenes: () => string[];
  prepare: (id: string, variant: string) => Scene;
  frame: (t: number) => void;
}
// The page side of each evaluate() call below; this file is never loaded in a browser.
declare const window: { themisMotion: ThemisMotion };
declare const document: { fonts: { ready: Promise<unknown> } };

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..');
const FPS = Number(process.env['FPS'] || 15);
const SCALE = Number(process.env['SCALE'] || 2);
const args = process.argv.slice(2);
const poster = args.includes('--poster');
const wanted = args.filter(a => !a.startsWith('--'));

const browser = await chromium.launch(process.env['CHROME_PATH'] ? { executablePath: process.env['CHROME_PATH'] } : {});
const probe = await browser.newPage();
await probe.goto(pathToFileURL(join(here, 'scenes.html')).href);
const ids = (await probe.evaluate(() => window.themisMotion.scenes())).filter(id => !wanted.length || wanted.includes(id));
await probe.close();

for (const id of ids) {
  const scale = SCALE;
  const page = await browser.newPage({ deviceScaleFactor: scale });
  for (const v of ['dark', 'light']) {
    await page.goto(pathToFileURL(join(here, 'scenes.html')).href, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const s = await page.evaluate(([id, v]) => window.themisMotion.prepare(id, v), [id, v] as const);
    await page.setViewportSize({ width: s.w, height: s.h });
    await page.waitForTimeout(500); // let the emblem and icon images decode
    const svg = page.locator('#export-stage svg');
    if (poster) {
      mkdirSync(join(here, 'posters'), { recursive: true });
      await page.evaluate((t) => { window.themisMotion.frame(t); }, s.poster);
      await svg.screenshot({ path: join(here, 'posters', `${id}-${v}.png`) });
      continue;
    }
    const dir = join(here, 'frames', `${id}-${v}`);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const n = Math.round(s.dur * FPS);
    for (let i = 0; i < n; i++) {
      await page.evaluate((t) => { window.themisMotion.frame(t); }, (s.poster + i / FPS) % s.dur);
      await svg.screenshot({ path: join(dir, `${String(i).padStart(4, '0')}.png`) });
    }
    const gif = join(out, `${id}-${v}.gif`);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(dir, '%04d.png'),
      '-vf', 'split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];[b][p]paletteuse=dither=none:diff_mode=rectangle',
      '-loop', '0', gif]);
    rmSync(dir, { recursive: true, force: true });
    console.log(`${id}-${v}.gif  ${s.w * scale}×${s.h * scale}  ${n} frames  ${(statSync(gif).size / 1024).toFixed(0)} KB`);
  }
  await page.close();
}
await browser.close();
