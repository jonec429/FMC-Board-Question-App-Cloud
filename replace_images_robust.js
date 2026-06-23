const fs = require('fs');
const path = require('path');

function getJpegDimensions(buffer) {
  let offset = 2; // skip FF D8
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xFF) break;
    const marker = buffer[offset + 1];
    if (marker === 0xC0 || marker === 0xC2) { // SOF0 or SOF2
      const height = buffer.readUInt16BE(offset + 5);
      const width = buffer.readUInt16BE(offset + 7);
      return { width, height };
    }
    const length = buffer.readUInt16BE(offset + 2);
    offset += 2 + length;
  }
  return null;
}

function carveJpegs(pdfPath, outDir) {
  const buffer = fs.readFileSync(pdfPath);
  let carved = [];
  let offset = 0;

  while (offset < buffer.length) {
    const start = buffer.indexOf(Buffer.from([0xFF, 0xD8, 0xFF]), offset);
    if (start === -1) break;

    const end = buffer.indexOf(Buffer.from([0xFF, 0xD9]), start);
    if (end === -1) break;

    const jpegData = buffer.slice(start, end + 2);
    
    if (jpegData.length > 5000) {
      const outPath = path.join(outDir, `carved_${carved.length + 1}.jpg`);
      fs.writeFileSync(outPath, jpegData);
      
      const dims = getJpegDimensions(jpegData);
      if (dims) {
        carved.push({
          path: outPath,
          width: dims.width,
          height: dims.height,
          size: jpegData.length
        });
      } else {
        // Just increment length so we don't overwrite if dimensions fail
        carved.push({ path: outPath, width: 0, height: 0 });
      }
    }
    offset = end + 2;
  }
  return carved;
}

const files = {
  2023: 'Copy of 2023ITEMultChoice.pdf',
  2024: '2024ITEMultChoice.pdf',
  2025: '2025ITEMultChoice.pdf'
};

function run() {
  const { imageSize } = require('image-size');

  for (const year of ['2023', '2024', '2025']) {
    console.log(`Processing ${year}...`);
    const carvedDir = path.join(__dirname, `public/images/${year}_carved`);
    if (!fs.existsSync(carvedDir)) fs.mkdirSync(carvedDir, { recursive: true });
    
    const carvedImages = carveJpegs(path.join(__dirname, `data/ITEs/${files[year]}`), carvedDir);
    
    const existingDir = path.join(__dirname, `public/images/${year}`);
    if (!fs.existsSync(existingDir)) continue;

    const existingFiles = fs.readdirSync(existingDir).filter(f => f.endsWith('.png'));
    
    for (const file of existingFiles) {
      const existingPath = path.join(existingDir, file);
      
      // We know existing files are PNGs, we can use our manual parser or Jimp if it's simpler, 
      // but let's just use Jimp to read dimensions to avoid image-size crashing
      try {
        const pngBuf = fs.readFileSync(existingPath);
        const w = pngBuf.readUInt32BE(16);
        const h = pngBuf.readUInt32BE(20);

        // Aspect ratio match instead of exact pixel match because Jimp might have resized or off-by-one?
        // Actually the dimensions should be identical.
        const match = carvedImages.find(c => c.width === w && c.height === h);
        if (match) {
          console.log(`Matched ${file} (${w}x${h}) -> ${path.basename(match.path)}`);
          const newFilename = file.replace('.png', '.jpg');
          fs.copyFileSync(match.path, path.join(existingDir, newFilename));
          fs.unlinkSync(existingPath); 
        } else {
          console.log(`NO MATCH for ${file} (${w}x${h})`);
        }
      } catch (e) {
        console.log(`Failed to process ${file}`, e.message);
      }
    }
  }
}

run();
