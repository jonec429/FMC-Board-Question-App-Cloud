const fs = require('fs');
const PDFParser = require('pdf2json');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const argv = yargs(hideBin(process.argv))
  .option('mc', { type: 'string', demandOption: true, describe: 'Path to Multiple Choice PDF' })
  .option('crit', { type: 'string', demandOption: true, describe: 'Path to Critique PDF' })
  .option('year', { type: 'number', demandOption: true, describe: 'Year of the ITE' })
  .argv;

function parsePDF(pdfPath) {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();
    pdfParser.on('pdfParser_dataError', errData => reject(errData.parserError));
    pdfParser.on('pdfParser_dataReady', pdfData => {
      let fullText = '';
      pdfData.Pages.forEach(page => {
        let lastY = -1;
        let pageText = '';
        page.Texts.forEach(t => {
          let str = '';
          try {
            str = decodeURIComponent(t.R[0].T);
          } catch(e) {
            str = t.R[0].T;
          }
          if (lastY !== -1 && Math.abs(t.y - lastY) > 0.5) {
            pageText += '\n'; 
          }
          pageText += str;
          lastY = t.y;
        });
        fullText += pageText + '\n';
      });
      resolve(fullText);
    });
    pdfParser.loadPDF(pdfPath);
  });
}

async function run() {
  console.log(`Parsing PDFs for ${argv.year}...`);
  let mcText = await parsePDF(argv.mc);
  let critText = await parsePDF(argv.crit);
  
  // Clean up critique specific headers
  critText = critText.replace(new RegExp(`${argv.year} ITE RATIONALE BOOK – PAGE \\d+`, 'gi'), '');
  critText = critText.replace(/American Board of Family Medicine.*All rights reserved\./gi, '');
  critText = critText.replace(/American Board ofFamily Medicine.*All rights reserved\./gi, '');
  
  mcText = mcText.replace(/American Board ofFamily Medicine.*All rights reserved\./gi, '');
  mcText = mcText.replace(/American Board of Family Medicine.*All rights reserved\./gi, '');
  
  // Also clean up Item # headers that might break splits
  mcText = mcText.replace(/Item #\d+/gi, '');
  
  const questions = {};
  
  // HACK: Add a newline to the very beginning if it starts with 1.
  if (mcText.trim().startsWith("1.")) {
     mcText = "\n" + mcText.trim();
  }
  
  // Split the text by question numbers.
  // This handles out-of-order text due to PDF column parsing!
  const parts = mcText.split(/\n\s*([0-9]{1,3})\.\s+/);
  
  for (let i = 1; i < parts.length; i += 2) {
    const qNum = parseInt(parts[i]);
    let block = parts[i+1];
    
    let qText = block.trim();
    let options = [];
    const optLetters = ['A', 'B', 'C', 'D', 'E'];
    let lastOptIdx = -1;
    
    for (let j = optLetters.length - 1; j >= 0; j--) {
        const letter = optLetters[j];
        let optStart = qText.indexOf("\n" + letter + ") ");
        if (optStart === -1) optStart = qText.indexOf("\n" + letter + ")");
        if (optStart === -1) optStart = qText.indexOf(" " + letter + ") "); 
        
        if (optStart !== -1) {
            if (lastOptIdx === -1) {
                options.unshift(letter + ") " + qText.substring(optStart + 3).trim());
            } else {
                options.unshift(letter + ") " + qText.substring(optStart + 3, lastOptIdx).trim());
            }
            lastOptIdx = optStart;
        }
    }
    
    if (lastOptIdx !== -1) {
        qText = qText.substring(0, lastOptIdx).trim();
    }
    
    questions[qNum] = {
        id: qNum,
        year: argv.year,
        question: qText.replace(/\s+/g, ' '),
        options: options.map(o => o.replace(/\s+/g, ' ')),
        answer: null,
        explanation: null
    };
  }

  // Extract critiques
  for (let qNum in questions) {
    const critStartRegex = new RegExp(`Item\\s*${qNum}\\s*\\n?ANSWER:\\s*([A-E])`, 'i');
    const startMatch = critText.match(critStartRegex);
    
    if (!startMatch) {
        console.warn(`Could not find critique for question ${qNum}`);
        continue;
    }
    
    questions[qNum].answer = startMatch[1].toUpperCase();
    
    let explanationStart = startMatch.index + startMatch[0].length;
    
    let endIdx = critText.length;
    const nextNum = parseInt(qNum) + 1;
    const nextCritStartRegex = new RegExp(`Item\\s*${nextNum}\\s*\\n?ANSWER:`, 'i');
    const nextMatch = critText.substring(explanationStart).match(nextCritStartRegex);
    
    if (nextMatch) {
        endIdx = explanationStart + nextMatch.index;
    }
    
    let block = critText.substring(explanationStart, endIdx);
    
    const refMatch = block.match(/\n\s*References?/i);
    if (refMatch) {
        block = block.substring(0, refMatch.index);
    } else {
        const inlineRef = block.match(/\s+References?/i);
        if (inlineRef) block = block.substring(0, inlineRef.index);
    }
    
    questions[qNum].explanation = block.trim().replace(/\s+/g, ' ');
  }

  const outPath = `data/ITEs/parsed_${argv.year}.json`;
  // Sort questions by ID so they look pretty in JSON
  const sortedKeys = Object.keys(questions).sort((a, b) => parseInt(a) - parseInt(b));
  const sortedQuestions = {};
  sortedKeys.forEach(k => sortedQuestions[k] = questions[k]);
  
  fs.writeFileSync(outPath, JSON.stringify(sortedQuestions, null, 2));
  console.log(`Saved ${Object.keys(sortedQuestions).length} questions to ${outPath}`);
}

run().catch(console.error);
