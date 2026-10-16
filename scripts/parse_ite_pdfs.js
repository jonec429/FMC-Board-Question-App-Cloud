const fs = require('fs');
const PDFParser = require('pdf2json');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const argv = yargs(hideBin(process.argv))
  .option('mc', { type: 'string', demandOption: true, describe: 'Path to Multiple Choice PDF' })
  .option('crit', { type: 'string', demandOption: true, describe: 'Path to Critique PDF' })
  .option('year', { type: 'number', demandOption: true, describe: 'Year of the ITE' })
  .argv;

const SUSPENDED_HYPHEN_FOLLOWERS = new Set([
  'and', 'or', 'to', 'by', 'of', 'in', 'for', 'with', 'vs', 'versus', 'nor', 'but',
]);

function repairText(raw, { isExplanation = false } = {}) {
  if (!raw) return '';
  let s = raw.replace(/\r\n/g, '\n').replace(/\u00A0/g, ' ');

  // 1. Replace Symbol-font Private Use Area characters
  s = s.replace(/\uf0b3/g, '≥');
  s = s.replace(/\uf0a3/g, '≤');
  s = s.replace(/\uf0b1/g, '±');
  s = s.replace(/\uf0b0/g, '°');
  s = s.replace(/\uf02e+/g, ' ');

  // 2. Collapse single line wraps inside paragraphs, but preserve double newlines
  s = s
    .split(/\n{2,}/)
    .map(para => para.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n');

  // 3. Restore dropped Greek letters (α, β, μ)
  s = s.replace(/(^|[\s(])-blocker(s?)\b/g, '$1β-blocker$2');
  s = s.replace(/(^|[\s(])-agonist(s?)\b/g, '$1β-agonist$2');
  s = s.replace(/(^|[\s(])-lactam(ase)?(s?)\b/g, '$1β-lactam$2$3');
  s = s.replace(/(^|[\s(])-carotene\b/g, '$1β-carotene');
  s = s.replace(/(^|[\s(])-thalassemia\b/g, '$1β-thalassemia');
  s = s.replace(/(^|[\s(])-fetoprotein\b/g, '$1α-fetoprotein');
  s = s.replace(/(\.\s+|\b)1-Antitrypsin\b/g, '$1α1-Antitrypsin');
  s = s.replace(/\b1-antitrypsin\b/g, 'α1-antitrypsin');
  s = s.replace(/\b- and β-thalassemia\b/g, 'α- and β-thalassemia');
  s = s.replace(/\b(\d+)\s+g,\s+(one|two|three|four|\d+)\s+puffs?\b/gi, '$1 μg, $2 puffs');
  s = s.replace(/\b(\d+\.\d+)\s+U\/mL\b(?=\s*\(N\s+0\.\d+)/g, '$1 μU/mL');
  s = s.replace(/\b(Mean corpuscular volume\s+\d+(?:\.\d+)?)\s+m3\b/gi, '$1 μm3');

  // 4. Fix missing superscripts in units
  s = s.replace(/\bkg\/m(?!2|²|\d)/g, 'kg/m2');
  s = s.replace(/(\d+)\/mm(?!3|³|\d|Hg|\s*Hg)/g, '$1/mm3');
  s = s.replace(/\bmL\/min\/1\.73\s*m(?!2|²|\d)/g, 'mL/min/1.73 m2');

  // 5. Rejoin PDF line-wrap hyphens
  s = s.replace(/\bC\s+-reactive\b/g, 'C-reactive');
  s = s.replace(/\b(IBS|x|T|Z|B|C|D|N|Q|S|ST|J)-\s+(C|D|ray|score|type|peptide|dimer|terminal|wave|segment|point)\b/g, '$1-$2');
  s = s.replace(/\b([A-Za-z]{2,})-\s+([a-z]{2,})\b/g, (match, left, right) => {
    if (SUSPENDED_HYPHEN_FOLLOWERS.has(right.toLowerCase())) return match;
    return `${left}-${right}`;
  });

  if (!isExplanation) {
    // 6. Format Laboratory Findings & colon-introduced lists
    const hasLabHeading = s.includes('Laboratory Findings');
    const hasColonList = /(?:following|following results|include|findings include|medications):/i.test(s);
    if (hasLabHeading || hasColonList) {
      s = s.replace(/\s*(Laboratory Findings)\s+/g, '\n\n$1\n');
      s = s.replace(
        /(following:|following results:|medications:|current medications include:|Laboratory findings include:)\s+/gi,
        '$1\n'
      );
      s = s.replace(/(\(N\s+[^)]+\))\s+(?=[A-Z])/g, '$1\n');
      s = s.replace(
        /\n(Her vital signs|His vital signs|On examination|The patient|You tell|A peripheral smear|Her calculated|His calculated|An examination|He currently walks|She currently walks)/g,
        '\n\n$1'
      );
    }
    // 7. Separate final lead-in question sentence
    s = s.replace(/(?:([.!?"])\s+|\n)(Which (?:one )?of the following)/g, '$1\n\n$2');
    s = s.replace(/\n{3,}/g, '\n\n');
  } else if (s.includes('Ref:')) {
    s = s.replace(/\.\s+\d{1,3}\s+(?=Ref:)/g, '. ');
    s = s.replace(/(\.\s*)\s+\d{1,3}$/g, '$1');
    s = s.replace(/\s*\bRef:\s*/g, '\n\nRef: ');
  }

  return s.trim();
}

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
          } catch (e) {
            str = t.R[0].T;
          }
          if (lastY !== -1) {
            const dy = Math.abs(t.y - lastY);
            if (dy > 1.35) {
              pageText += '\n\n';
            } else if (dy > 0.45) {
              pageText += '\n';
            }
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
  critText = critText.replace(/American Board of\s*Family Medicine.*All rights reserved\./gi, '');

  mcText = mcText.replace(/American Board of\s*Family Medicine.*All rights reserved\./gi, '');

  // Also clean up Item # headers that might break splits
  mcText = mcText.replace(/Item #\d+/gi, '');

  const questions = {};

  if (mcText.trim().startsWith('1.')) {
    mcText = '\n' + mcText.trim();
  }

  // Split the text by question numbers
  const parts = mcText.split(/\n\s*([0-9]{1,3})\.\s+/);

  for (let i = 1; i < parts.length; i += 2) {
    const qNum = parseInt(parts[i]);
    let block = parts[i + 1];

    let qText = block.trim();
    let options = [];
    const optLetters = ['A', 'B', 'C', 'D', 'E'];
    let lastOptIdx = -1;

    for (let j = optLetters.length - 1; j >= 0; j--) {
      const letter = optLetters[j];
      let optStart = qText.indexOf('\n' + letter + ') ');
      if (optStart === -1) optStart = qText.indexOf('\n' + letter + ')');
      if (optStart === -1) optStart = qText.indexOf(' ' + letter + ') ');

      if (optStart !== -1) {
        if (lastOptIdx === -1) {
          options.unshift(qText.substring(optStart + 3).trim());
        } else {
          options.unshift(qText.substring(optStart + 3, lastOptIdx).trim());
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
      question: repairText(qText, { isExplanation: false }),
      options: options.map(o => repairText(o.replace(/^[A-E][.)]\s+/, ''), { isExplanation: false })),
      answer: null,
      explanation: null,
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

    questions[qNum].explanation = repairText(block.trim(), { isExplanation: true });
  }

  const outPath = `data/ITEs/parsed_${argv.year}.json`;
  const sortedKeys = Object.keys(questions).sort((a, b) => parseInt(a) - parseInt(b));
  const sortedQuestions = {};
  sortedKeys.forEach(k => (sortedQuestions[k] = questions[k]));

  fs.writeFileSync(outPath, JSON.stringify(sortedQuestions, null, 2));
  console.log(`Saved ${Object.keys(sortedQuestions).length} questions to ${outPath}`);
}

run().catch(console.error);
