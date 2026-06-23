const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const parsedData = JSON.parse(fs.readFileSync('data/ITEs/parsed_2025.json', 'utf8'));
  const oldData = JSON.parse(fs.readFileSync('data/ITEs/test_batch_old.json', 'utf8'));
  
  for (let i = 0; i < 5; i++) {
    const dbId = oldData[i].id;
    const pq = parsedData[i + 1];
    
    let correctIndex = pq.answer.charCodeAt(0) - 65;
    const cleanOptions = pq.options.map(opt => opt.replace(/^[A-E]\)\s*/, '').trim());
    
    const updates = {
      question_text: pq.question,
      explanation: pq.explanation,
      options: cleanOptions,
      correct_index: correctIndex
    };
    
    console.log(`Updating DB ID ${dbId} with parsed question ${pq.id}...`);
    const { error: updateError } = await supabase.from('questions').update(updates).eq('id', dbId);
    if (updateError) {
      console.error('Update failed:', updateError);
    } else {
      console.log(`Successfully updated ${dbId}`);
    }
  }
}

run().catch(console.error);
