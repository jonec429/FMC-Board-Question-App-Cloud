const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function fixGreekAndSpacing(str) {
  if (!str) return str;
  let s = str.replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim();
  s = s.replace(/\uf02e+/g, ' ');
  s = s.replace(/\bC\s+-reactive/g, 'C-reactive');
  s = s.replace(/(\s)-blocker/g, '$1β-blocker');
  s = s.replace(/(\s)-agonist/g, '$1β-agonist');
  s = s.replace(/(\s)-lactam/g, '$1β-lactam');
  s = s.replace(/(\s)-carotene/g, '$1β-carotene');
  s = s.replace(/(\s)-thalassemia/g, '$1β-thalassemia');
  s = s.replace(/(\s)-fetoprotein/g, '$1α-fetoprotein');
  s = s.replace(/\bas-\s+needed/g, 'as-needed');
  return s;
}

function formatQuestionText(raw) {
  if (!raw) return raw;
  const divIdx = raw.indexOf('<div');
  const textPart = divIdx !== -1 ? raw.substring(0, divIdx) : raw;
  const htmlPart = divIdx !== -1 ? raw.substring(divIdx) : '';

  let s = fixGreekAndSpacing(textPart);

  const hasLabHeading = s.includes('Laboratory Findings');
  const hasColonList = /(?:following|following results|include|findings include|medications):/i.test(s);

  if (hasLabHeading || hasColonList) {
    s = s.replace(/\s*(Laboratory Findings)\s+/g, '\n\n$1\n');
    s = s.replace(/(following:|following results:|medications:|current medications include:|Laboratory findings include:)\s+/gi, '$1\n');
    s = s.replace(/(\(N\s+[^)]+\))\s+(?=[A-Z])/g, '$1\n');
    s = s.replace(/(Serum glucose \d+ mg\/dL|Glucose \d+ mg\/dL|Pleural fluid protein [\d.]+ g\/dL|Pleural fluid LDH \d+ IU\/L|Pleural fluid glucose \d+ mg\/dL|Total cholesterol \d+ mg\/dL|HDL-cholesterol \d+ mg\/dL|LDL-cholesterol \d+ mg\/dL|Triglycerides \d+ mg\/dL|Hemoglobin A1c [\d.]+%|Estimated glomerular filtration rate \d+ mL\/min\/1\.73 m2|CBC normal|Urine hCG negative|Urine dipstick 2\+ urobilinogen|Lipase normal|Urine ketones trace|Arterial pH [\d.]+|Anion gap normal|Urine ketones 4\+|Urine glucose 4\+|Antimitochondrial antibodies positive)\s+(?=[A-Z])/g, '$1\n');

    const medLists = [
      'Acetaminophen', 'Amlodipine (Norvasc)', 'Atorvastatin (Lipitor)', 'Escitalopram (Lexapro)', 'Lisinopril (Zestril)',
      'Insulin glargine (Lantus)', 'Levothyroxine (Synthroid)', 'Liraglutide (Victoza)',
      'Hydrochlorothiazide', 'Metformin',
      'Aspirin, 81 mg daily', 'Carvedilol (Coreg), 12.5 mg twice daily', 'Empagliflozin (Jardiance), 10 mg daily', 'Losartan (Cozaar), 50 mg daily', 'Losartan (Cozaar)',
      'Metoprolol succinate (Toprol-XL)', 'Sertraline (Zoloft)', 'Warfarin',
      'Adapalene 0.1% gel (Differin Gel) daily', 'Famotidine (Pepcid), 20 mg as needed', 'Fluticasone propionate (Flonase), 50 μg daily', 'Hydroxyzine (Vistaril), 25 mg as needed', 'Polyethylene glycol (MiraLAX), 17 g as needed',
      'Carvedilol (Coreg), 25 mg twice daily', 'Dapagliflozin (Farxiga), 10 mg daily', 'Furosemide (Lasix), 20 mg daily', 'Metformin, 500 mg twice daily', 'Sacubitril/valsartan (Entresto), 97/103 mg twice daily', 'Spironolactone (Aldactone), 25 mg daily',
      'Amoxicillin/clavulanate (Augmentin)', 'Fludrocortisone', 'Prednisolone',
      'Low-dose aspirin', 'Rosuvastatin (Crestor)',
      'Alprazolam (Xanax), 0.5 mg nightly', 'Buspirone, 10 mg 3 times daily', 'Gabapentin (Neurontin), 600 mg 3 times daily', 'Lorazepam (Ativan), 1 mg twice daily', 'Sertraline (Zoloft), 200 mg daily',
      'Desvenlafaxine (Pristiq), 50 mg daily', 'Doxepin, 10 mg daily at bedtime', 'Methylphenidate, 5 mg twice daily', 'Ziprasidone (Geodon), 40 mg twice daily'
    ];
    medLists.sort((a, b) => b.length - a.length);
    for (let pass = 0; pass < 8; pass++) {
      for (const med of medLists) {
        const escaped = med.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const reg = new RegExp(`((?:\\n|:)\\s*${escaped})\\s+(?=[A-Z])`, 'g');
        s = s.replace(reg, '$1\n');
      }
    }

    s = s.replace(/\n(Her vital signs|On examination|The patient|You tell|A peripheral smear|Her calculated|An examination|He currently walks)/g, '\n\n$1');
  }

  s = s.replace(/(?:([.!?"])\s+|\n)(Which (?:one )?of the following)/g, '$1\n\n$2');
  s = s.replace(/\n{3,}/g, '\n\n');

  return htmlPart ? s + '\n\n' + htmlPart : s;
}

async function run() {
  console.log('Fetching questions...');
  const { data: questions, error } = await supabase.from('questions').select('id, question_text, explanation');
  if (error) throw error;
  
  let updatedCount = 0;
  
  for (const q of questions) {
    const origQ = q.question_text || '';
    const origE = q.explanation || '';
    
    const newQ = formatQuestionText(origQ);
    const newE = fixGreekAndSpacing(origE);
    
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
