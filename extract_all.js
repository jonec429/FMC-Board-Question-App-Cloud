const fs = require('fs');
const path = require('path');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const { Jimp, rgbaToInt } = require('jimp');

async function saveImage(img, outputPath) {
  const width = img.width;
  const height = img.height;
  const data = img.data;
  
  // If it's RGB (3 bytes per pixel)
  const isRGB = data.length === width * height * 3;
  // If it's RGBA
  const isRGBA = data.length === width * height * 4;
  // Grayscale
  const isGray = data.length === width * height;

  const image = new Jimp({ width, height, color: 0xffffffff });

  let dataOffset = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r, g, b, a = 255;
      if (isRGB) {
        r = data[dataOffset++];
        g = data[dataOffset++];
        b = data[dataOffset++];
      } else if (isRGBA) {
        r = data[dataOffset++];
        g = data[dataOffset++];
        b = data[dataOffset++];
        a = data[dataOffset++];
      } else if (isGray) {
        r = g = b = data[dataOffset++];
      } else {
        r = data[dataOffset++];
        g = data[dataOffset++];
        b = data[dataOffset++];
      }
      image.setPixelColor(rgbaToInt(r, g, b, a), x, y);
    }
  }
  
  await image.write(outputPath);
}

async function extractImagesFromPdf(year, pdfFilename) {
  const pdfPath = path.join(__dirname, `data/ITEs/${pdfFilename}`);
  const outDir = path.join(__dirname, `public/images/${year}`);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const doc = await pdfjsLib.getDocument(pdfPath).promise;
  
  let totalSaved = 0;

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const ops = await page.getOperatorList();
    
    let imgCount = 0;
    for (let j = 0; j < ops.fnArray.length; j++) {
      const fn = ops.fnArray[j];
      if (fn === pdfjsLib.OPS.paintImageXObject || fn === pdfjsLib.OPS.paintJpegXObject) {
        const imgName = ops.argsArray[j][0];
        try {
          const img = page.objs.get(imgName);
          if (img && img.data && img.width > 50 && img.height > 50) {
            imgCount++;
            const outputPath = path.join(outDir, `page_${i}_img_${imgCount}.png`);
            await saveImage(img, outputPath);
            console.log(`Saved ${outputPath}`);
            totalSaved++;
          }
        } catch (e) {
          console.error(`Error saving image on page ${i}:`, e.message);
        }
      }
    }
  }
  return totalSaved;
}

async function run() {
  const files = {
    2023: 'Copy of 2023ITEMultChoice.pdf',
    2024: '2024ITEMultChoice.pdf',
    2025: '2025ITEMultChoice.pdf'
  };

  for (const [year, filename] of Object.entries(files)) {
    console.log(`Extracting images for ${year}...`);
    try {
      const count = await extractImagesFromPdf(year, filename);
      console.log(`Finished ${year}, extracted ${count} images.`);
    } catch(e) {
      console.error(`Failed ${year}:`, e);
    }
  }
}

run();
