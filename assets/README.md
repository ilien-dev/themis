# Brand assets

A Greek coin with the blindfolded profile of Themis. The blindfold, in Aegean blue, is the only colour: she holds both rule files to the same text without looking at which one it is. The tagline is what the plugin keeps true: *Two files, one text.*

## Files

| File | Use |
|---|---|
| `themis-emblem.svg` / `.png` | The coin: engraved portrait, beaded rim, ΘΕΜΙΣ legend. One version for both grounds, since a marble disc reads on light and dark |
| `themis-light.svg` / `.png` | Horizontal lockup (coin, wordmark, tagline) for light backgrounds |
| `themis-dark.svg` / `.png` | The same lockup for dark backgrounds |
| `themis-symbol.svg`, `themis-symbol-{512,180,32}.png` | Companion mark: the profile as a solid silhouette, for avatars and favicons |
| `themis-social.svg` / `.png` | 1280 × 640 GitHub social preview. Upload it by hand in Settings → Social preview; GitHub has no API for it |
| `motion/*-{light,dark}.gif` | README animations: `hero`, `parity`, `cap` |

Every SVG is vector, with text converted to outlines so GitHub renders it without loading fonts. The PNGs are exported from the SVGs.

## Palette

| Token | Light | Dark |
|---|---|---|
| Ground | `#F2EEE6` marble | `#0C1420` night |
| Ink | `#101B2D` night blue | `#ECE6DA` marble |
| Accent | `#1D6A99` Aegean | `#5BB0DD` light Aegean |
| Secondary text | `#5F6673` stone | `#8B93A1` |

Contrast against each theme's ground: ink 14.9:1, accent 5.1:1 (light) and 7.7:1 (dark), secondary text 5.0:1 and 6.0:1. The animations use GitHub's own grounds (`#ffffff`, `#0d1117`) so they sit flush on the README.

## Type

- Wordmark: [Cinzel](https://github.com/NDISCOVER/Cinzel) SemiBold, all caps, +0.12 em tracking.
- Coin legend: [Noto Serif](https://github.com/notofonts/latin-greek-cyrillic) SemiBold, Greek capitals.
- Tagline, diagrams and animations: [IBM Plex Mono](https://github.com/IBM/plex) Regular and Medium.

All three are under the SIL Open Font License 1.1. `motion/source/fonts/` carries the Cinzel and Plex Mono WOFF2 files the animations load.

## How it was made

1. **Raw images.** Codex generated the portrait and the silhouette on 2026-10-02 from the prompts below; the chosen originals are in `source/raw/`. No lettering was generated: image models distort letters, and Greek ones most.
2. **Tracing.** `source/trace.ts` splits each image into an ink layer and a blue layer and traces both with potrace.
3. **Assembly.** `source/coin.ts` builds the coin (rim, beads, legend on an arc) around the traced portrait. `source/build.ts` makes the lockups, symbol and social preview, sets the text as outlines with opentype.js, and optimizes with svgo.
4. **Animation.** `motion/source/scenes.html` draws each scene as a function of time; `motion/source/export.ts` screenshots it frame by frame with Playwright and encodes the GIF with ffmpeg.

To rebuild (the scripts are TypeScript and run as they are on Node.js 22.18 or later):

```
cd assets/source
npm install
node trace.ts raw/emblem-1.png work/emblem-1.json 2 6
node trace.ts raw/mark-1.png work/mark-1.json 1 20
node coin.ts work/emblem-1.json work/coin.svg
node build.ts

cd ../motion/source
npm install && npx playwright install chromium
node export.ts            # needs ffmpeg on PATH; CHROME_PATH uses a Chromium you already have
```

### Prompts

Emblem (variant 1 of 4 was chosen):

> Square 1024x1024 image. A classical Greek coin portrait of the goddess Themis in strict profile facing left: head and neck only, cut at the base of the neck like the portrait on an Athenian drachma. Her eyes are covered by a simple blindfold tied at the back of the head. The blindfold is ONE flat area of solid blue (#1D6A99) with no lines inside it; it is the only color in the image. Hair gathered in a low chignon with a few wavy strands and a thin fillet. Calm, dignified, timeless. Rendering, strictly for vector tracing: pure black ink on pure white. Engraving made of coarse parallel hatching lines that follow the forms, about 60-90 lines across the whole face, each line clearly separated by white. Clean contour lines. No stippling, no dots, no gradients, no gray, no fine crosshatching, no paper texture. Composition: the portrait sits centered inside an imaginary circle about 68% of the canvas width, with an even white margin all around. No coin rim, no border, no background, no text, no letters, no signature.

Companion mark (variant A of 2, with the chosen emblem attached as reference):

> Using the reference engraved portrait, draw the same left-facing profile of Themis as a single solid silhouette for an app icon. Square 1024x1024, pure black silhouette on pure white. Match the reference exactly in profile line, low chignon and straight neck cut. The blindfold is one flat band of solid blue (#1D6A99) crossing the silhouette, with the same tie and two ribbon ends as the reference. Keep only the outer contour; no interior lines, no hatching, no shading, no gray. Hair as one solid mass with two thin white gaps suggesting the waves. Centered, filling about 70% of the canvas. No text, no border, no background.
