const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const stringSimilarity = require('string-similarity');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const years = [2025, 2024, 2023];
  let sqlStatements = [];
  let testSqlStatements = [];

  for (const year of years) {
    const parsedData = JSON.parse(fs.readFileSync(`data/ITEs/parsed_${year}.json`, 'utf8'));
    const parsedQuestions = Object.values(parsedData);
    
    console.log(`\nProcessing Year ${year}... (${parsedQuestions.length} parsed questions)`);
    
    // Fetch DB questions for this year
    const { data: dbQuestions, error } = await supabase
      .from('questions')
      .select('id, question_text, explanation, options, correct_index')
      .eq('year', year.toString());
      
    if (error) {
      console.error(`Error fetching year ${year}:`, error);
      continue;
    }
    
    console.log(`Fetched ${dbQuestions.length} DB questions for ${year}`);
    
    let matchedCount = 0;
    
    for (const dbQ of dbQuestions) {
      // Find best match in parsed
      const matchRatings = parsedQuestions.map(pq => {
        // Compare question text, ignoring case and punctuation for better matching
        const cleanDbText = dbQ.question_text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
        const cleanPqText = pq.question.toLowerCase().replace(/[^a-z0-9\s]/g, '');
        const rating = stringSimilarity.compareTwoStrings(cleanDbText, cleanPqText);
        return { pq, rating };
      });
      
      matchRatings.sort((a, b) => b.rating - a.rating);
      const bestMatch = matchRatings[0];
      
      if (bestMatch.rating < 0.5) {
        console.warn(`[WARNING] Low similarity for DB ID ${dbQ.id} (${bestMatch.rating.toFixed(2)}): ${dbQ.question_text.substring(0, 50)}`);
        continue;
      }
      
      matchedCount++;
      const pq = bestMatch.pq;
      
      // Map options letters A-E to correct_index 0-4
      let correctIndex = pq.answer.charCodeAt(0) - 65; // A = 0, B = 1...
      
      // Clean up options (remove the leading "A) ", "B) ")
      const cleanOptions = pq.options.map(opt => opt.replace(/^[A-E]\)\s*/, '').trim());
      
      // SQL Escaping function
      const esc = (str) => {
        if (!str) return "NULL";
        return "'" + str.replace(/'/g, "''") + "'";
      };
      
      const sql = `UPDATE public.questions SET question_text = ${esc(pq.question)}, explanation = ${esc(pq.explanation)}, options = '${JSON.stringify(cleanOptions).replace(/'/g, "''")}'::jsonb, correct_index = ${correctIndex} WHERE id = '${dbQ.id}';`;
      
      sqlStatements.push(sql);
      
      // Select 5 test questions from 2025
      if (year === 2025 && testSqlStatements.length < 5) {
        testSqlStatements.push(sql);
      }
    }
    
    console.log(`Matched ${matchedCount}/${dbQuestions.length} questions for ${year}`);
  }
  
  fs.writeFileSync('data/ITEs/migration_full.sql', sqlStatements.join('\n'));
  fs.writeFileSync('data/ITEs/migration_test.sql', testSqlStatements.join('\n'));
  
  console.log(`\nWrote ${sqlStatements.length} total SQL statements to data/ITEs/migration_full.sql`);
  console.log(`Wrote ${testSqlStatements.length} test SQL statements to data/ITEs/migration_test.sql`);
}

run().catch(console.error);
