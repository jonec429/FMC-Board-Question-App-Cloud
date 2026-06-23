const fs = require('fs');
const PDFParser = require("pdf2json");

const pdfParser = new PDFParser(); // without the `this, 1` it outputs JSON

pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError));
pdfParser.on("pdfParser_dataReady", pdfData => {
    fs.writeFileSync('scratch_pdf_json.json', JSON.stringify(pdfData, null, 2));
    console.log('Dumped to scratch_pdf_json.json');
});

pdfParser.loadPDF("data/ITEs/2025ITECritique.pdf");
