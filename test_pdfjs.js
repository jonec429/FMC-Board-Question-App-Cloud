const fs = require('fs');
const path = require('path');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

async function testExtraction() {
  const pdfPath = path.join(__dirname, 'data/ITEs/2024ITEMultChoice.pdf');
  const loadingTask = pdfjsLib.getDocument(pdfPath);
  const doc = await loadingTask.promise;
  
  console.log('Opened PDF, pages:', doc.numPages);
  
  // Just scan the first 50 pages to find an image and log its structure
  for (let i = 1; i <= 50; i++) {
    const page = await doc.getPage(i);
    const ops = await page.getOperatorList();
    
    for (let j = 0; j < ops.fnArray.length; j++) {
      const fn = ops.fnArray[j];
      if (fn === pdfjsLib.OPS.paintImageXObject || fn === pdfjsLib.OPS.paintJpegXObject) {
        const imgName = ops.argsArray[j][0];
        try {
          const img = page.objs.get(imgName);
          if (img) {
            console.log(`Found image on page ${i}:`, Object.keys(img), `Width: ${img.width}, Height: ${img.height}`);
            if (img.data) {
                console.log(`Data length: ${img.data.length}, Expected (w*h*4): ${img.width * img.height * 4}`);
            }
            return;
          }
        } catch (e) {
          console.error(`Error getting object on page ${i}:`, e.message);
        }
      }
    }
  }
  console.log('No image found in first 50 pages.');
}

testExtraction().catch(console.error);
