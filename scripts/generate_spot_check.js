const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

async function run() {
  const { data: dbQ, error } = await supabase.from('questions').select('id, year, question_text, options, correct_index');
  if (error) throw error;

  const y23 = dbQ.filter(q => q.year === '2023');
  const y24 = dbQ.filter(q => q.year === '2024');
  const y25 = dbQ.filter(q => q.year === '2025');

  shuffleArray(y23);
  shuffleArray(y24);
  shuffleArray(y25);

  const sample23 = y23.slice(0, 20);
  const sample24 = y24.slice(0, 20);
  const sample25 = y25.slice(0, 20);

  let md = `# Database Verbatim Text Spot Check\n\n`;
  md += `Here is a random sample of 20 questions from each year (60 total) fetched directly from the live database. Please review them to verify formatting, fidelity, and accuracy.\n\n`;

  const years = [
    { year: 2025, samples: sample25 },
    { year: 2024, samples: sample24 },
    { year: 2023, samples: sample23 }
  ];

  for (let y of years) {
      md += `## Year ${y.year}\n\n`;
      y.samples.forEach((q, idx) => {
          md += `### Q${idx + 1} (DB ID: ${q.id})\n`;
          md += `> **${q.question_text}**\n>\n`;
          const letters = ['A', 'B', 'C', 'D', 'E'];
          q.options.forEach((opt, i) => {
              if (i === q.correct_index) {
                  md += `> - [x] **${letters[i]}) ${opt}** (Correct)\n`;
              } else {
                  md += `> - [ ] ${letters[i]}) ${opt}\n`;
              }
          });
          md += `\n---\n\n`;
      });
  }

  fs.writeFileSync('spot_check_report.md', md);
  console.log('Generated spot_check_report.md');
}

run().catch(console.error);
