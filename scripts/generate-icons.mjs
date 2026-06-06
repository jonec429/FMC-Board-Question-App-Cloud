// Generates the PWA raster icons from the program mark.
//
//   1. The source mark lives at  public/brand/program-mark.png
//      (the triquetra mark, cropped from public/brand/program-logo.png).
//   2. Run  npm run icons  to regenerate every PNG below.
//
// Keeps the home-screen icons in sync with the program logo shown in the app
// headers. Each icon is the mark centered on a white tile with padding.

import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mark = join(root, 'public', 'brand', 'program-mark.png');
const iconsDir = join(root, 'public', 'icons');

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
const PAD = 0.16; // fraction of the tile kept as margin around the mark

async function makeIcon(size, file) {
  const inner = Math.round(size * (1 - 2 * PAD));
  const centered = await sharp(mark)
    .resize({ width: inner, height: inner, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: WHITE } })
    .composite([{ input: centered, gravity: 'center' }])
    .png()
    .toFile(join(iconsDir, file));
  console.log(`✓ ${file} (${size}×${size})`);
}

await makeIcon(192, 'icon-192x192.png');
await makeIcon(512, 'icon-512x512.png');
await makeIcon(180, 'apple-touch-icon.png');

console.log('Done. Icons written to public/icons/');
