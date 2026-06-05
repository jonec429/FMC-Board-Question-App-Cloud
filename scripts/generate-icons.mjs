// Generates the PWA raster icons from the shield source art.
//
//   1. Edit the artwork in  public/icons/pwa-icon.svg
//   2. Run  npm run icons   to regenerate every PNG below.
//
// Keeps the home-screen icons in sync with the in-app shield logo
// (components/AppIcons.tsx -> AbfmShield).

import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const iconsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
const source = join(iconsDir, 'pwa-icon.svg');
const BRAND_BLUE = '#1e3a8a';

const svg = await readFile(source);

// Manifest icons keep the rounded-corner transparency so launchers and the
// browser can apply their own masking. Rendered at high density for crisp edges.
const manifestIcons = [
  { size: 192, file: 'icon-192x192.png' },
  { size: 512, file: 'icon-512x512.png' },
];

for (const { size, file } of manifestIcons) {
  await sharp(svg, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(join(iconsDir, file));
  console.log(`✓ ${file} (${size}×${size})`);
}

// iOS dislikes transparency and rounds the corners itself, so flatten the
// apple-touch icon onto solid brand blue to get a clean square.
await sharp(svg, { density: 384 })
  .resize(180, 180)
  .flatten({ background: BRAND_BLUE })
  .png()
  .toFile(join(iconsDir, 'apple-touch-icon.png'));
console.log('✓ apple-touch-icon.png (180×180)');

console.log('Done. Icons written to public/icons/');
