const text1 = `A 47-year-old female sees you for routine follow-up. Her past medical history is significant for hypertension, hyperlipidemia, depression, and osteoarthritis. She tells you that she has noticed her ankles swelling over the past few months. In addition to a physical examination and other indicated evaluations, you also review her medications, which include the following: Acetaminophen Amlodipine (Norvasc) Atorvastatin (Lipitor) Escitalopram (Lexapro) Lisinopril (Zestril) Which one of her medications is most likely to cause edema?`;

const text2 = `A 58-year-old female with coronary artery disease and alcohol use disorder presents with progressive shortness of breath over the past 3 weeks. A chest radiograph demonstrates bilateral pleural effusions that are greater on the right side. Laboratory studies, including pleural fluid analysis, show the following: Serum protein5.5 g/dL (N 6.0–8.0) Serum LDH305 IU/L (N 105–333) Plasma glucose88 mg/dL (N 70–100) Pleural fluid protein2.9 g/dL Pleural fluid LDH295 IU/L Pleural fluid glucose51 mg/dL Which one of the following is the most likely cause of the effusion?`;

const text3 = `Laboratory Findings Hemoglobin A1c 6.4% Hemoglobin 12.2 g/dL (N 13.2–16.6) Creatinine 1.1 mg/dL (N 0.7–1.3) Potassium 4.2 mEq/L (N 3.5–5.1) Creatine kinase 84 U/L (N 55–170) Erythrocyte sedimentation rate 88 mm/hr (N 0–20) C -reactive protein 9.2 mg/L (N 0–0.3) Antinuclear antibody <1:40 (N <1:40) Which one of the following is the most likely cause of this patient's myalgias?`;

const text4 = `Laboratory studies reveal the following: CBC normal Urine hCG negative Urine dipstick 2+ urobilinogen Bilirubin 6.5 mg/dL (N 0.2–1.2) Lipase normal AST 50 U/L (N 0–35) ALT 66 U/L (N 0–45) Alkaline phosphatase 1382 U/L (N 30–120) Gamma-glutamyl transferase 120 U/L (N 0–30) Which one of the following is the most likely cause of this patient’s symptoms?`;

function formatText(text) {
  let formatted = text;

  // 1. Remove unicode dots
  formatted = formatted.replace(/\uf02e+/g, ' ');

  // 2. Fix Laboratory Findings heading
  formatted = formatted.replace(/Laboratory Findings /g, '\nLaboratory Findings\n');
  formatted = formatted.replace(/Laboratory studies reveal the following: /g, 'Laboratory studies reveal the following:\n');
  formatted = formatted.replace(/Laboratory studies, including pleural fluid analysis, show the following: /g, 'Laboratory studies, including pleural fluid analysis, show the following:\n');
  formatted = formatted.replace(/medications, which include the following: /g, 'medications, which include the following:\n');

  // 3. Lab findings and list items parsing is tricky. We'll use a regex for boundaries.
  // Example boundaries:
  // - " (N X-Y) " -> should have newline after
  // - " normal " -> should have newline after
  // - " negative " -> should have newline after
  // - " (BrandName) " -> should have newline after

  // Let's add newlines before capitalized words if they follow a list item end marker.
  // Wait, if it follows `(N ...)` it's easier:
  formatted = formatted.replace(/(\(N [^)]+\))\s+([A-Z])/g, '$1\n$2');
  
  // For 'normal' or 'negative' or 'positive' followed by a capitalized lab test:
  // e.g. `CBC normal Urine hCG negative Urine dipstick 2+ urobilinogen Bilirubin...`
  // Here, `normal ` is followed by `Urine` -> `normal\nUrine`
  formatted = formatted.replace(/(normal|negative|positive)\s+([A-Z][a-z])/g, '$1\n$2');
  
  // For medication list: `Acetaminophen Amlodipine (Norvasc) Atorvastatin (Lipitor)`
  // A capitalized word immediately followed by another capitalized word or `(Capitalized)`.
  // Wait, the medication name might just be one word.
  // `(Norvasc) Atorvastatin` -> `(Norvasc)\nAtorvastatin`
  formatted = formatted.replace(/(\([A-Z][a-zA-Z]+\))\s+([A-Z])/g, '$1\n$2');

  // We should also look for ` Which one of the following` and prepend newline.
  formatted = formatted.replace(/ (Which one of)/g, '\n\n$1');
  
  // For `Pleural fluid protein 2.9 g/dL Pleural fluid LDH...`
  // We can look for `(g/dL|IU/L|mg/dL|mEq/L|mm/hr|mg/L|%|pg\/mL)\s+([A-Z])`
  formatted = formatted.replace(/(g\/dL|IU\/L|mg\/dL|mEq\/L|mm\/hr|mg\/L|%|pg\/mL|U\/L)\s+([A-Z])/g, '$1\n$2');

  // For `urobilinogen Bilirubin`
  formatted = formatted.replace(/(urobilinogen)\s+([A-Z])/g, '$1\n$2');

  // Wait, for `Acetaminophen Amlodipine` - two capitalized words in a row without punctuation.
  // In `Acetaminophen Amlodipine (Norvasc)`, `Acetaminophen` doesn't have a parenthetical!
  // It's just `Word Word (Word)`
  // If we have `([a-z]) ([A-Z][a-z]+)` it might be the end of a word and start of a new one. But this happens in normal sentences too! "She tells you" (no). "include the following: Acetaminophen" (yes).
  
  return formatted;
}

console.log("Q1:"); console.log(formatText(text1)); console.log("\n");
console.log("Q5:"); console.log(formatText(text2)); console.log("\n");
console.log("Q17:"); console.log(formatText(text3)); console.log("\n");
console.log("Q16:"); console.log(formatText(text4)); console.log("\n");
