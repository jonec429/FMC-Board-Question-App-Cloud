const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
  const { data: allQuestions, error: e2 } = await supabase.from('questions').select('id, question_text, explanation, options');
  if (e2) {
    console.error('Error fetching all questions:', e2);
    return;
  }

  const keywords = ['image', 'figure', 'shown below', 'radiograph', 'x-ray', 'xray', 'ecg', 'ekg', 'electrocardiogram', 'photograph', 'picture', 'rhythm strip', 'shown'];
  
  const matches = allQuestions.filter(q => {
    const textLower = (q.question_text || '').toLowerCase();
    return keywords.some(kw => textLower.includes(kw));
  });

  console.log(`Found ${matches.length} questions matching broad keywords.`);
  matches.forEach(m => {
    console.log(`\n--- ID: ${m.id} ---`);
    console.log(`Text: ${m.question_text}`);
  });
}

main();
