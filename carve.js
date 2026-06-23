const fs = require('fs');
const path = require('path');

function carveJpegs(pdfPath, outDir) {
  const buffer = fs.readFileSync(pdfPath);
  let count = 0;
  let offset = 0;

  while (offset < buffer.length) {
    const start = buffer.indexOf(Buffer.from([0xFF, 0xD8, 0xFF]), offset);
    if (start === -1) break;

    const end = buffer.indexOf(Buffer.from([0xFF, 0xD9]), start);
    if (end === -1) break;

    const jpegData = buffer.slice(start, end + 2);
    
    // Check if it's a decent size to ignore thumbnails
    if (jpegData.length > 5000) {
      count++;
      const outPath = path.join(outDir, `carved_${count}.jpg`);
      fs.writeFileSync(outPath, jpegData);
      console.log(`Carved ${outPath} (${jpegData.length} bytes)`);
    }
    
    offset = end + 2;
  }
  return count;
}

const outDir = path.join(__dirname, 'public/images/2024_carved');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
carveJpegs(path.join(__dirname, 'data/ITEs/2024ITEMultChoice.pdf'), outDir);
