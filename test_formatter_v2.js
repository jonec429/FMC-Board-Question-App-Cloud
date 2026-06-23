const fs = require('fs');

const texts = [
  `A 47-year-old female sees you for routine follow-up. Her past medical history is significant for hypertension, hyperlipidemia, depression, and osteoarthritis. She tells you that she has noticed her ankles swelling over the past few months. In addition to a physical examination and other indicated evaluations, you also review her medications, which include the following: Acetaminophen Amlodipine (Norvasc) Atorvastatin (Lipitor) Escitalopram (Lexapro) Lisinopril (Zestril) Which one of her medications is most likely to cause edema?`,
  `A 58-year-old female with coronary artery disease and alcohol use disorder presents with progressive shortness of breath over the past 3 weeks. A chest radiograph demonstrates bilateral pleural effusions that are greater on the right side. Laboratory studies, including pleural fluid analysis, show the following: Serum protein5.5 g/dL (N 6.0–8.0) Serum LDH305 IU/L (N 105–333) Plasma glucose88 mg/dL (N 70–100) Pleural fluid protein2.9 g/dL Pleural fluid LDH295 IU/L Pleural fluid glucose51 mg/dL Which one of the following is the most likely cause of the effusion?`,
  `Laboratory Findings Hemoglobin A1c 6.4% Hemoglobin 12.2 g/dL (N 13.2–16.6) Creatinine 1.1 mg/dL (N 0.7–1.3) Potassium 4.2 mEq/L (N 3.5–5.1) Creatine kinase 84 U/L (N 55–170) Erythrocyte sedimentation rate 88 mm/hr (N 0–20) C -reactive protein 9.2 mg/L (N 0–0.3) Antinuclear antibody <1:40 (N <1:40) Which one of the following is the most likely cause of this patient's myalgias?`,
  `Laboratory studies reveal the following: CBC normal Urine hCG negative Urine dipstick 2+ urobilinogen Bilirubin 6.5 mg/dL (N 0.2–1.2) Lipase normal AST 50 U/L (N 0–35) ALT 66 U/L (N 0–45) Alkaline phosphatase 1382 U/L (N 30–120) Gamma-glutamyl transferase 120 U/L (N 0–30) Which one of the following is the most likely cause of this patient’s symptoms?`,
  `A 72-year-old male with a history of type 2 diabetes comes to your office for evaluation of muscle aches and fatigue. His current medications include rosuvastatin (Crestor), dapagliflozin (Farxiga), and semaglutide (Ozempic). Over the past month he has noticed increasing pain in his hips, thighs, and shoulders without any apparent trigger.`
];

function formatText(text) {
  let formatted = text;

  // 1. Remove unicode dots
  formatted = formatted.replace(/\uf02e+/g, ' ');

  // 2. Fix Laboratory Findings heading
  formatted = formatted.replace(/(Laboratory Findings)\s+([A-Z])/g, '\n$1\n$2');
  formatted = formatted.replace(/(Laboratory studies reveal the following:)\s+([A-Z])/g, '$1\n$2');
  formatted = formatted.replace(/(Laboratory studies, including pleural fluid analysis, show the following:)\s+([A-Z])/g, '$1\n$2');
  formatted = formatted.replace(/(medications, which include the following:)\s+([A-Z])/g, '$1\n$2');

  // 3. Lab findings
  // Newline after (N X-Y)
  formatted = formatted.replace(/(\(N [^)]+\))\s+([A-Z])/g, '$1\n$2');
  
  // Newline after normal/negative/positive
  formatted = formatted.replace(/(normal|negative|positive)\s+([A-Z])/g, '$1\n$2');
  
  // Newline before "Which one of" or "Which of the following"
  formatted = formatted.replace(/\s+(Which (?:one )?of the following)/gi, '\n\n$1');

  // Newline after specific units
  formatted = formatted.replace(/(g\/dL|IU\/L|mg\/dL|mEq\/L|mm\/hr|mg\/L|%|pg\/mL|U\/L|μU\/mL|pg\/dL)\s+([A-Z])/g, '$1\n$2');

  // Special cases for list items
  formatted = formatted.replace(/(urobilinogen)\s+([A-Z])/g, '$1\n$2');

  // 4. Medication lists
  // Find "the following:\n" or "the following: " followed by capitalized words until "Which"
  formatted = formatted.replace(/(the following:\s*)([\s\S]*?)(\n\nWhich)/, (match, p1, p2, p3) => {
    // If there are no periods or commas in p2, it's likely a list separated by spaces
    if (!p2.includes('.') && !p2.includes(',')) {
      // Add newline before any word starting with Capital letter, except if it's inside parens
      // Wait, just split by `\s+(?=[A-Z])` but ignore if inside parens.
      let list = p2.split(/\s+/).reduce((acc, word) => {
        if (word.match(/^[A-Z]/) && !acc.endsWith('(') && !word.startsWith('(')) {
          return acc + '\n' + word;
        }
        return acc + ' ' + word;
      }, '').trim();
      return p1 + list + p3;
    }
    return match;
  });

  return formatted;
}

texts.forEach((t, i) => {
  console.log(`\n=== Q${i+1} ===`);
  console.log(formatText(t));
});
