const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function formatText(text) {
  if (!text) return text;
  let formatted = text;

  // 1. Remove unicode dots
  formatted = formatted.replace(/\uf02e+/g, ' ');

  // 2. Fix Laboratory Findings heading
  formatted = formatted.replace(/(Laboratory Findings)\s+([A-Z])/g, '\n$1\n$2');
  formatted = formatted.replace(/(Laboratory studies reveal the following:)\s+([A-Z])/g, '$1\n$2');
  formatted = formatted.replace(/(Laboratory studies, including pleural fluid analysis, show the following:)\s+([A-Z])/g, '$1\n$2');
  formatted = formatted.replace(/(medications, which include the following:)\s+([A-Z])/g, '$1\n$2');

  // 3. Lab findings
  formatted = formatted.replace(/(\(N [^)]+\))\s+([A-Z])/g, '$1\n$2');
  formatted = formatted.replace(/(normal|negative|positive)\s+([A-Z])/g, '$1\n$2');
  formatted = formatted.replace(/\s+(Which (?:one )?of the following)/gi, '\n\n$1');
  formatted = formatted.replace(/(g\/dL|IU\/L|mg\/dL|mEq\/L|mm\/hr|mg\/L|%|pg\/mL|U\/L|μU\/mL|pg\/dL)\s+([A-Z])/g, '$1\n$2');
  formatted = formatted.replace(/(urobilinogen)\s+([A-Z])/g, '$1\n$2');

  // 4. Medication lists
  formatted = formatted.replace(/(include the following:\s*)([A-Z][\s\S]*?)(\n\nWhich)/g, (match, p1, p2, p3) => {
    let list = p2.split(/\s+/).reduce((acc, word) => {
      if (word.match(/^[A-Z]/) && !acc.endsWith('(') && !word.startsWith('(') && acc !== '') {
        return acc + '\n' + word;
      }
      return acc + (acc === '' ? '' : ' ') + word;
    }, '').trim();
    return p1 + list + p3;
  });

  // Multiple newlines to double newlines
  formatted = formatted.replace(/\n{3,}/g, '\n\n');

  return formatted;
}

async function run() {
  console.log('Fetching questions...');
  const { data: questions, error } = await supabase.from('questions').select('id, question_text, explanation');
  if (error) throw error;
  
  let updatedCount = 0;
  
  for (const q of questions) {
    const origQ = q.question_text || '';
    const origE = q.explanation || '';
    
    const newQ = formatText(origQ);
    const newE = formatText(origE);
    
    if (origQ !== newQ || origE !== newE) {
      const { error: updateError } = await supabase.from('questions').update({
        question_text: newQ,
        explanation: newE
      }).eq('id', q.id);
      
      if (updateError) {
        console.error('Error updating ' + q.id, updateError);
      } else {
        updatedCount++;
      }
    }
  }
  
  console.log(`Updated ${updatedCount} questions!`);
}

run().catch(console.error);
