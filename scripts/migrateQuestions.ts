import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load env vars
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateQuestions() {
  const csvPath = path.join(__dirname, 'questions.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.error('questions.csv not found in scripts folder!');
    return;
  }

  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  
  const questions = [];

  // Basic CSV Parser (handles quotes roughly)
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    
    // Regex to split CSV while respecting quotes
    const row = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)?.map(v => v.replace(/^"|"$/g, '').trim());
    if (!row) continue;

    // Mapping based on your QUESTION_BANK headers:
    // ["Year", "Category", "Question", "Correct Index", "Explanation", "Resource Link", "Opt A", "Opt B", "Opt C", "Opt D", "Opt E"]
    const q = {
      year: row[0],
      category: row[1],
      system: row[1], // Duplicate for compatibility
      question_text: row[2],
      correct_index: parseInt(row[3]),
      explanation: row[4],
      resource_link: row[5],
      options: [row[6], row[7], row[8], row[9], row[10]].filter(o => o && o !== 'undefined'),
    };

    if (q.question_text) questions.push(q);
  }

  console.log(`Parsed ${questions.length} questions. Starting upload...`);

  const { data, error } = await supabase
    .from('questions')
    .insert(questions);

  if (error) {
    console.error('Migration failed:', error);
  } else {
    console.log('Migration successful! Questions are now in the Cloud.');
  }
}

migrateQuestions();
