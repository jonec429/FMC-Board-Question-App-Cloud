require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const files = {
  2023: 'Copy of 2023ITEMultChoice.pdf',
  2024: '2024ITEMultChoice.pdf',
  2025: '2025ITEMultChoice.pdf'
};

async function getPageText(page) {
  const textContent = await page.getTextContent();
  return textContent.items.map(item => item.str).join(' ');
}

function normalize(str) {
  return str.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

async function mapImages() {
  const { data: questions, error } = await supabase
    .from('questions')
    .select('id, year, question_text')
    .ilike('question_text', '%shown below%');
    
  if (error) {
    console.error('Error fetching questions:', error);
    return;
  }

  let updatedCount = 0;

  for (const [year, filename] of Object.entries(files)) {
    const yearQuestions = questions.filter(q => q.year == year);
    if (yearQuestions.length === 0) continue;

    const pdfPath = path.join(__dirname, `data/ITEs/${filename}`);
    const doc = await pdfjsLib.getDocument(pdfPath).promise;
    
    const pageTexts = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const text = await getPageText(page);
      pageTexts.push({ pageNumber: i, text: normalize(text) });
    }

    const imgDir = path.join(__dirname, `public/images/${year}`);
    const availableImages = fs.existsSync(imgDir) ? fs.readdirSync(imgDir) : [];

    for (const q of yearQuestions) {
      // First, strip out any existing img tags we appended so we can re-run
      let cleanText = q.question_text.replace(/\n\n<img src="\/images.*$/s, '');

      const qSnippet = normalize(cleanText.slice(15, 150));
      
      const match = pageTexts.find(pt => pt.text.includes(qSnippet));
      if (match) {
        let targetPage = match.pageNumber;
        
        let imgFiles = availableImages.filter(f => f.startsWith(`page_${targetPage}_img_`));
        if (imgFiles.length === 0) {
          targetPage = match.pageNumber + 1;
          imgFiles = availableImages.filter(f => f.startsWith(`page_${targetPage}_img_`));
        }

        if (imgFiles.length > 0) {
          let imgTags = imgFiles.map(img => `<img src="/images/${year}/${img}" alt="Clinical Image" style="max-width: 100%; border-radius: 8px; margin-top: 1rem;" />`).join('\n');
          const newText = cleanText + `\n\n<div style="display:flex; flex-direction:column; gap: 1rem;">${imgTags}</div>`;
          await supabase.from('questions').update({ question_text: newText }).eq('id', q.id);
          updatedCount++;
          console.log(`Updated [Q: ${q.id}] with ${imgFiles.length} image(s) from page ${targetPage}.`);
        }
      }
    }
  }

  console.log(`\nSuccessfully updated ${updatedCount} questions with images!`);
}

mapImages().then(() => console.log('Done.')).catch(console.error);
