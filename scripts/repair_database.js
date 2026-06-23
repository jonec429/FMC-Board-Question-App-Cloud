const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('Loading parsed PDF JSONs...');
  const parsed = {
    2023: JSON.parse(fs.readFileSync('data/ITEs/parsed_2023.json', 'utf8')),
    2024: JSON.parse(fs.readFileSync('data/ITEs/parsed_2024.json', 'utf8')),
    2025: JSON.parse(fs.readFileSync('data/ITEs/parsed_2025.json', 'utf8')),
  };

  console.log('Building 2025 CSV map...');
  const lines = fs.readFileSync('questions.csv', 'utf8').split('\n');
  const csvMap2025 = {}; // resource_link + '|' + category => qId
  lines.forEach(l => {
    if (l.startsWith('2025,')) {
      const regex = /(?:^|,)(?:"([^"]*)"|([^,]*))/g;
      let parts = [];
      let match;
      while (match = regex.exec(l)) {
        parts.push(match[1] !== undefined ? match[1] : match[2]);
      }
      const category = parts[1];
      const rl = parts[5];
      const qId = parseInt(parts[13], 10).toString(); // trim leading zeros
      if (rl && category) {
         csvMap2025[rl + '|' + category] = qId;
      }
    }
  });

  console.log('Fetching all database questions...');
  const { data: dbQ, error } = await supabase.from('questions').select('id, year, resource_link, abfm_category');
  if (error) throw error;

  console.log(`Fetched ${dbQ.length} DB questions.`);
  let fixedCount = 0;
  let errorCount = 0;

  for (let q of dbQ) {
    if (!q.year || !q.resource_link) continue;
    let targetQNum = null;

    if (q.year === '2023' || q.year === '2024') {
       // Extract "Item X"
       const m = q.resource_link.match(/Item\s+(\d+)/i);
       if (m) {
           targetQNum = parseInt(m[1], 10).toString();
       }
    } else if (q.year === '2025') {
       // Look up in CSV map
       const key = q.resource_link + '|' + q.abfm_category;
       if (csvMap2025[key]) {
           targetQNum = csvMap2025[key];
       } else {
           // Fallback to just resource link if category slightly mismatched
           const fallbackKey = Object.keys(csvMap2025).find(k => k.startsWith(q.resource_link + '|'));
           if (fallbackKey) targetQNum = csvMap2025[fallbackKey];
       }
    }

    if (!targetQNum) {
        console.warn(`Could not determine target QNum for DB ID ${q.id} (Year: ${q.year})`);
        errorCount++;
        continue;
    }

    const pq = parsed[q.year][targetQNum];
    if (!pq || !pq.question || !pq.options || !pq.answer) {
        console.warn(`Could not find parsed question for Year ${q.year} QNum ${targetQNum}`);
        errorCount++;
        continue;
    }

    // Now we update the database UUID with the EXACT text it's supposed to have
    let correctIndex = pq.answer.charCodeAt(0) - 65;
    const cleanOptions = pq.options.map(opt => opt.replace(/^[A-E]\)\s*/, '').trim());
      
    const updates = {
        question_text: pq.question,
        explanation: pq.explanation,
        options: cleanOptions,
        correct_index: correctIndex
    };

    const { error: updateError } = await supabase.from('questions').update(updates).eq('id', q.id);
    if (updateError) {
        console.error(`Failed to update DB ID ${q.id}:`, updateError);
        errorCount++;
    } else {
        fixedCount++;
    }
  }

  console.log(`\nRepair complete. Successfully fixed and restored ${fixedCount} questions.`);
  if (errorCount > 0) console.log(`Encountered ${errorCount} errors.`);
}

run().catch(console.error);
