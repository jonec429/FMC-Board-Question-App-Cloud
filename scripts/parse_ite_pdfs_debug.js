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
        let pageText = page.Texts.map(t => {
          try {
            return decodeURIComponent(t.R[0].T);
          } catch(e) {
            return t.R[0].T;
          }
        }).join('');
        // Clean up weird PDF splits
        pageText = pageText.replace(/It\s*em\s+(\d+)/gi, '\nItem $1\n');
        pageText = pageText.replace(/ANSWER:\s*([A-E])/gi, '\nANSWER: $1\n');
        // Add newlines before questions to help regex
        pageText = pageText.replace(/\s+(\d+)\.\s+/g, '\n$1. ');
        pageText = pageText.replace(/\s+([A-E])\)\s+/g, '\n$1) ');
        
        fullText += pageText + '\n';
      });
      resolve(fullText);
    });
    pdfParser.loadPDF(pdfPath);
  });
}

async function run() {
  console.log(`Parsing PDFs for ${argv.year}...`);
  const mcText = await parsePDF(argv.mc);
  const critText = await parsePDF(argv.crit);
  
  const mcLines = mcText.split('\n');
  const critLines = critText.split('\n');
  
  const questions = {};
  let currentQ = null;
  
  for (let line of mcLines) {
    line = line.trim();
    if (!line) continue;
    
    const qMatch = line.match(/^(\d+)\.\s+(.*)/);
    if (qMatch) {
      currentQ = parseInt(qMatch[1]);
      questions[currentQ] = { question: qMatch[2].trim(), options: [], year: argv.year, id: currentQ };
      continue;
    }
    
    if (currentQ) {
      const optMatch = line.match(/^([A-E])\)\s+(.*)/);
      if (optMatch) {
        questions[currentQ].options.push(optMatch[1] + ') ' + optMatch[2].trim());
      } else {
        if (questions[currentQ].options.length === 0) {
          questions[currentQ].question += ' ' + line;
        } else {
          questions[currentQ].options[questions[currentQ].options.length - 1] += ' ' + line;
        }
      }
    }
  }

  let currentCritQ = null;
  let inExplanation = false;
  
  for (let line of critLines) {
    line = line.trim();
    if (!line) continue;
    
    const itemMatch = line.match(/^Item\s+(\d+)/i);
    if (itemMatch) {
      currentCritQ = parseInt(itemMatch[1]);
      inExplanation = false;
      continue;
    }

    if (currentCritQ && questions[currentCritQ]) {
      const ansMatch = line.match(/^ANSWER:\s*([A-E])/i);
      if (ansMatch) {
        questions[currentCritQ].answer = ansMatch[1].toUpperCase();
        questions[currentCritQ].explanation = [];
        inExplanation = true;
        continue;
      }
      
      const refMatch = line.match(/^Reference/i) || line.match(/^R\s*eference/i);
      if (refMatch) {
        inExplanation = false;
        continue;
      }

      if (inExplanation && line.length > 2 && !line.includes('PAGE') && !line.includes('RATIONALE BOOK')) {
        questions[currentCritQ].explanation.push(line);
      }
    }
  }

  Object.values(questions).forEach(q => {
    if (q.explanation) {
      q.explanation = q.explanation.join(' ').replace(/\s+/g, ' ');
    }
    q.question = q.question.replace(/\s+/g, ' ');
    q.options = q.options.map(o => o.replace(/\s+/g, ' '));
  });

  console.log(mcLines.slice(0, 50)); const outPath = `data/ITEs/parsed_${argv.year}.json`;
  fs.writeFileSync(outPath, JSON.stringify(questions, null, 2));
  console.log(`Saved ${Object.keys(questions).length} questions to ${outPath}`);
}

run().catch(console.error);
