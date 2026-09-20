const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const prefixMap = {
  "hile": "While",
  "erfusion": "Perfusion",
  "his": "This",
  "ommercial": "Commercial",
  "ospice": "Hospice",
  "epatitis": "Hepatitis",
  "ymptomatic": "Symptomatic",
  "he": "The",
  "ccording": "According",
  "hen": "When",
  "ombination": "Combination",
  "rimary": "Primary",
  "dema": "Edema",
  "redictors": "Predictors",
  "reatment": "Treatment",
  "orderline": "Borderline",
  "luoride": "Fluoride",
  "n": "In",
  "inea": "Tinea",
  "ecause": "Because",
  "ismuth": "Bismuth",
  "atients": "Patients",
  "eliac": "Celiac",
  "outine": "Routine",
  "ender": "Tender",
  "aryngitis": "Pharyngitis",
  "utism": "Autism",
  "rthostatic": "Orthostatic",
  "eart": "Heart",
  "ased": "Based",
  "hyroiditis": "Thyroiditis",
  "ntibiotics": "Antibiotics",
  "f": "Of",
  "urner": "Turner",
  "any": "Many",
  "uillain-Barré": "Guillain-Barré",
  "uillain-barré": "Guillain-Barré",
  "olymyalgia": "Polymyalgia",
  "ichen": "Lichen",
  "atellofemoral": "Patellofemoral",
  "here": "There",
  "edical": "Medical",
  "ultiple": "Multiple",
  "ostpartum": "Postpartum",
  "reteral": "Ureteral",
  "ika": "Zika",
  "or": "For",
  "orticosteroid": "Corticosteroid",
  "ore": "More",
  "eakness": "Weakness",
  "hysician": "Physician",
  "enous": "Venous",
  "yspareunia": "Dyspareunia",
  "hildren": "Children",
  "possible": "A possible",
  "diagnosis": "A diagnosis",
  "on": "On",
  "nly": "Only",
  "chocardiography": "Echocardiography",
  "ll": "All",
  "retest": "Pretest",
  "econdary": "Secondary",
  "oft-tissue": "Soft-tissue",
  "ocal": "Vocal",
  "upportive": "Supportive",
  "hese": "These",
  "roton": "Proton",
  "ric": "Uric",
  "step": "A step",
  "stepwise": "A stepwise",
  "nychomycosis": "Onychomycosis",
  "iabetic": "Diabetic",
  "eratoacanthomas": "Keratoacanthomas",
  "remic": "Uremic",
  "wo": "Two",
  "and-foot-and-mouth": "Hand-foot-and-mouth",
  "besity": "Obesity",
  "alliative": "Palliative",
  "yperparathyroidism": "Hyperparathyroidism",
  "ung": "Lung",
  "olyethylene": "Polyethylene",
  "ating": "Eating",
  "lthough": "Although",
  "ne": "One",
  "andomized,": "Randomized,",
  "andomized": "Randomized",
  "merican": "American",
  "uidelines": "Guidelines",
  "urrent": "Current",
  "ommon": "Common"
};

async function run() {
  const { data } = await supabase.from('questions').select('id, explanation');
  let updatedCount = 0;
  let unmapped = [];

  for (const q of data) {
    const text = q.explanation.trim();
    if (!text) continue;
    
    const firstChar = text[0];
    if (firstChar && firstChar === firstChar.toLowerCase() && firstChar.match(/[a-z]/i)) {
      const firstWord = text.split(/[ \n]/)[0];
      const cleanWord = firstWord.replace(/[^\w-é]/g, ''); // handle punctuation attached to word
      
      let mapped = prefixMap[cleanWord] || prefixMap[firstWord];
      
      // Special single letter cases
      if (!mapped && cleanWord === 'n') mapped = 'In';
      if (!mapped && cleanWord === 'f') mapped = 'Of';
      
      if (mapped) {
        const newText = text.replace(firstWord, mapped);
        await supabase.from('questions').update({ explanation: newText }).eq('id', q.id);
        updatedCount++;
      } else {
        unmapped.push(firstWord);
      }
    }
  }

  console.log(`Updated ${updatedCount} explanations.`);
  if (unmapped.length > 0) {
    console.log('Unmapped words:', [...new Set(unmapped)]);
  }
}

run();
