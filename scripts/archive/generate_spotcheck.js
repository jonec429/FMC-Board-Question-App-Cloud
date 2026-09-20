const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

async function run() {
  let md = '# Final Spot Check Report (Updated)\n\n';
  md += 'Here are 20 randomly selected questions from each year (2023, 2024, and 2025) to verify that all formatting, lab results, medications, and truncated drop-cap letters in the explanations have been completely fixed.\n\n';

  for (const year of ['2023', '2024', '2025']) {
    const { data } = await supabase.from('questions').select('*').eq('year', year);
    
    if (!data || data.length === 0) continue;
    
    const selected = shuffleArray(data).slice(0, 20);
    
    md += `## Year ${year}\n\n`;
    
    selected.forEach((q, index) => {
      md += `### ${index + 1}. Question ID: ${q.id}\n\n`;
      
      let text = q.question_text;
      text = text.replace(/<div[^>]*>/g, '\n\n');
      text = text.replace(/<\/div>/g, '\n\n');
      const regex = /<img src="\/images\/(\d{4})\/(.*?)"(.*?)\/>/g;
      text = text.replace(regex, (match, yearMatch, filename) => {
        const destPath = path.join('C:/Users/jcarb/.gemini/antigravity/brain/44b1555d-3786-42b5-9090-0366cb521b59', `${yearMatch}_${filename}`);
        return `\n\n![${filename}](/${destPath.replace(/\\/g, '/')})\n\n`;
      });

      md += `**Question Text:**\n\n${text}\n\n`;
      
      let optionsList = [];
      try {
        optionsList = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
        md += `**Options:**\n`;
        optionsList.forEach(opt => {
          md += `- ${opt}\n`;
        });
      } catch (e) {
        md += `**Options:** ${q.options}\n`;
      }
      
      const correctAnswer = optionsList[q.correct_index] || 'N/A';
      md += `\n**Correct Answer:** ${correctAnswer}\n\n`;
      md += `**Explanation:**\n\n${q.explanation}\n\n`;
      md += `---\n\n`;
    });
  }

  const outPath = 'C:/Users/jcarb/.gemini/antigravity/brain/44b1555d-3786-42b5-9090-0366cb521b59/final_spot_check.md';
  fs.writeFileSync(outPath, md);
  console.log(`Saved to ${outPath}`);
}

run();
