const fs = require('fs');
const path = require('path');
const { imageSize } = require('image-size');

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
    
    // Check if it's a decent size to ignore thumbnails
    if (jpegData.length > 5000) {
      const outPath = path.join(outDir, `carved_${carved.length + 1}.jpg`);
      fs.writeFileSync(outPath, jpegData);
      
      try {
        const dimensions = imageSize(outPath);
        carved.push({
          path: outPath,
          width: dimensions.width,
          height: dimensions.height,
          size: jpegData.length
        });
      } catch (e) {
        console.error('Error reading size of carved jpeg:', outPath, e.message);
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
      const dim = imageSize(existingPath);
      
      // Find a matching carved JPEG by width and height
      const match = carvedImages.find(c => c.width === dim.width && c.height === dim.height);
      if (match) {
        console.log(`Matched ${file} (${dim.width}x${dim.height}) -> ${path.basename(match.path)}`);
        // Replace it! Rename the .png to .jpg, copy the raw file
        const newFilename = file.replace('.png', '.jpg');
        fs.copyFileSync(match.path, path.join(existingDir, newFilename));
        fs.unlinkSync(existingPath); // Delete the bad PNG
      } else {
        console.log(`NO MATCH for ${file} (${dim.width}x${dim.height})`);
      }
    }
  }
}

run();
