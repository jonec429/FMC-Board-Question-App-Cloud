const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const sim = require('string-similarity');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function runForYear(year) {
  console.log(`\n============================`);
  console.log(`Starting migration for ${year}`);
  console.log(`============================`);
  
  if (!fs.existsSync(`data/ITEs/parsed_${year}.json`)) {
    console.log(`No parsed file for ${year}, skipping.`);
    return;
  }
  
  const parsedDataObj = JSON.parse(fs.readFileSync(`data/ITEs/parsed_${year}.json`, 'utf8'));
  const parsedData = Object.values(parsedDataObj);
  
  if (parsedData.length === 0) {
    console.log(`Parsed data for ${year} is empty.`);
    return;
  }
  
  // Fetch DB questions for this year
  // (Assuming there is a 'year' column or similar. We can filter by created_at or title, but let's just fetch all and filter by text matching)
  // Since we don't have a 'year' column strictly indexed maybe, let's just fetch ALL questions and do a global match.
  // Actually, wait, let's fetch all questions once outside.
}

async function run() {
  console.log('Fetching all questions from DB...');
  const { data: dbQuestions, error } = await supabase.from('questions').select('id, question_text, explanation');
  
  if (error) {
    console.error('Error fetching questions:', error);
    return;
  }
  
  console.log(`Fetched ${dbQuestions.length} questions from DB.`);
  
  const years = [2023, 2024, 2025];
  let totalUpdated = 0;
  
  for (let year of years) {
    if (!fs.existsSync(`data/ITEs/parsed_${year}.json`)) continue;
    const parsedDataObj = JSON.parse(fs.readFileSync(`data/ITEs/parsed_${year}.json`, 'utf8'));
    const parsedData = Object.values(parsedDataObj);
    
    let yearUpdated = 0;
    
    for (let pq of parsedData) {
      if (!pq.question || !pq.answer || !pq.options || pq.options.length === 0) {
         continue; // skip incomplete
      }
      
      // Self check 1: Find best match in DB
      let bestMatch = null;
      let highestSim = 0;
      
      for (let dbq of dbQuestions) {
        let similarity = sim.compareTwoStrings(dbq.question_text || '', pq.question || '');
        if (similarity > highestSim) {
          highestSim = similarity;
          bestMatch = dbq;
        }
      }
      
      // Self check 2: Threshold validation
      // Even with paraphrasing, the vocabulary overlap should be > 0.3
      if (highestSim < 0.3) {
         console.warn(`[WARNING] Skipping parsed ${year} Q${pq.id}: Best match too low (${highestSim.toFixed(2)})`);
         continue;
      }
      
      let correctIndex = pq.answer.charCodeAt(0) - 65;
      const cleanOptions = pq.options.map(opt => opt.replace(/^[A-E]\)\s*/, '').trim());
      
      const updates = {
        question_text: pq.question,
        explanation: pq.explanation,
        options: cleanOptions,
        correct_index: correctIndex
      };
      
      // Update the database
      const { error: updateError } = await supabase.from('questions').update(updates).eq('id', bestMatch.id);
      
      if (updateError) {
        console.error(`[ERROR] Failed to update DB ID ${bestMatch.id}:`, updateError);
      } else {
        yearUpdated++;
        // Remove from dbQuestions to prevent double matching
        dbQuestions.splice(dbQuestions.indexOf(bestMatch), 1);
      }
    }
    
    console.log(`Successfully updated ${yearUpdated} questions for ${year}.`);
    totalUpdated += yearUpdated;
  }
  
  console.log(`\nMigration complete. Total updated: ${totalUpdated}`);
}

run().catch(console.error);
