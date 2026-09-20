const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const artifactDir = 'C:/Users/jcarb/.gemini/antigravity/brain/44b1555d-3786-42b5-9090-0366cb521b59';

async function run() {
  const { data } = await supabase.from('questions').select('id, year, question_text').ilike('question_text', '%<img%');
  
  let md = '# Questions with Images\n\n';
  md += 'Here are all of the questions that currently have images attached. The extraction bug has been fixed, and these are the untouched, perfectly preserved high-quality JPEGs directly from the PDFs.\n\n';

  for (const q of data) {
    md += `### Question ID: ${q.id} (${q.year})\n\n`;
    
    let text = q.question_text;
    
    // First, remove the div tags that prevent markdown from parsing
    text = text.replace(/<div[^>]*>/g, '\n\n');
    text = text.replace(/<\/div>/g, '\n\n');
    
    const regex = /<img src="\/images\/(\d{4})\/(.*?)"(.*?)\/>/g;
    
    text = text.replace(regex, (match, year, filename) => {
      const sourcePath = path.join(__dirname, 'public/images', year, filename);
      const destPath = path.join(artifactDir, `${year}_${filename}`);
      
      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, destPath);
      }
      
      return `\n\n![${filename}](/${destPath.replace(/\\/g, '/')})\n\n`;
    });

    md += text + '\n\n---\n\n';
  }

  const outPath = path.join(artifactDir, 'all_images_preview.md');
  fs.writeFileSync(outPath, md);
  console.log(`Saved to ${outPath}`);
}

run();
