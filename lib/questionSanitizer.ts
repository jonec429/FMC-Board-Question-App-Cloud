/**
 * Shared sanitizer and structural formatter for board questions.
 *
 * Protects against common PDF-extraction and copy-paste artifacts:
 *  1. Symbol-font Private Use Area Unicode (\uF0B3 -> ≥, \uF0A3 -> ≤, etc.)
 *  2. Dropped Greek letters (α, β, μ) in medical terms and lab units
 *  3. Missing unit superscripts (kg/m2, /mm3, mL/min/1.73 m2)
 *  4. Broken PDF line-wrap hyphens ("follow- up" -> "follow-up", "x- ray" -> "x-ray")
 *  5. Collapsed inline Laboratory Findings tables and lead-in prompts
 *  6. Leaked ABFM headers, footers, and page numbers before Ref:
 */

export interface SanitizeTextResult {
  text: string;
  repairs: string[];
  warnings: string[];
}

export interface SanitizeQuestionResult {
  question_text: string;
  options: string[];
  explanation: string;
  repairs: string[];
  warnings: string[];
}

// Words that legitimately follow a suspended hyphen ("high- or moderate-intensity")
const SUSPENDED_HYPHEN_FOLLOWERS = new Set([
  'and',
  'or',
  'to',
  'by',
  'of',
  'in',
  'for',
  'with',
  'vs',
  'versus',
  'nor',
  'but',
]);

/**
 * Repairs character-level PDF extraction issues (PUA glyphs, dropped Greek letters,
 * broken hyphens, missing superscripts, and leaked headers/footers).
 */
export function repairCharactersAndSpacing(
  raw: string,
  options: { isExplanation?: boolean; preserveNewlines?: boolean } = {}
): SanitizeTextResult {
  if (!raw) return { text: '', repairs: [], warnings: [] };

  const repairs = new Set<string>();
  const warnings = new Set<string>();

  let s = raw.replace(/\r\n/g, '\n').replace(/\u00A0/g, ' ');

  // 1. Strip leaked ABFM headers/footers
  const beforeHeaderStrip = s;
  s = s.replace(/American Board of\s*Family Medicine[^\n.]*All rights reserved\./gi, '');
  s = s.replace(/\d{4}\s+ITE RATIONALE BOOK\s*[–-]\s*PAGE\s+\d+/gi, '');
  s = s.replace(/\bItem\s*#\s*\d+\b/gi, '');
  if (s !== beforeHeaderStrip) {
    repairs.add('Stripped leaked PDF header/footer text');
  }

  // 2. Replace Symbol-font Private Use Area (PUA) characters
  const beforePua = s;
  s = s.replace(/\uf0b3/g, '≥');
  s = s.replace(/\uf0a3/g, '≤');
  s = s.replace(/\uf0b1/g, '±');
  s = s.replace(/\uf0b0/g, '°');
  s = s.replace(/\uf02e+/g, ' ');
  if (s !== beforePua) {
    repairs.add('Converted Symbol-font Private Use characters (≥/≤/±)');
  }

  // Normalize horizontal whitespace (preserving newlines if requested)
  if (options.preserveNewlines) {
    s = s
      .split('\n')
      .map(line => line.replace(/[ \t]+/g, ' ').trim())
      .join('\n')
      .trim();
  } else {
    s = s.replace(/\s+/g, ' ').trim();
  }

  // 3. Restore dropped Greek letters (α, β, μ)
  const beforeGreek = s;
  s = s.replace(/(^|[\s(])-blocker(s?)\b/g, '$1β-blocker$2');
  s = s.replace(/(^|[\s(])-agonist(s?)\b/g, '$1β-agonist$2');
  s = s.replace(/(^|[\s(])-lactam(ase)?(s?)\b/g, '$1β-lactam$2$3');
  s = s.replace(/(^|[\s(])-carotene\b/g, '$1β-carotene');
  s = s.replace(/(^|[\s(])-thalassemia\b/g, '$1β-thalassemia');
  s = s.replace(/(^|[\s(])-fetoprotein\b/g, '$1α-fetoprotein');
  s = s.replace(/(\.\s+|\b)1-Antitrypsin\b/g, '$1α1-Antitrypsin');
  s = s.replace(/\b1-antitrypsin\b/g, 'α1-antitrypsin');
  s = s.replace(/\b- and β-thalassemia\b/g, 'α- and β-thalassemia');
  // Metered dose inhalers where μ was dropped before g ("44 g, four puffs", "90 g, two puffs")
  s = s.replace(/\b(\d+)\s+g,\s+(one|two|three|four|\d+)\s+puffs?\b/gi, '$1 μg, $2 puffs');
  // TSH / micro-unit lab values where μ was dropped before U/mL
  s = s.replace(/\b(\d+\.\d+)\s+U\/mL\b(?=\s*\(N\s+0\.\d+)/g, '$1 μU/mL');
  // MCV where μ was dropped before m3
  s = s.replace(/\b(Mean corpuscular volume\s+\d+(?:\.\d+)?)\s+m3\b/gi, '$1 μm3');
  if (s !== beforeGreek) {
    repairs.add('Restored dropped Greek symbol (α/β/μ)');
  }

  // 4. Fix missing superscripts in standard medical units
  const beforeUnits = s;
  s = s.replace(/\bkg\/m(?!2|²|\d)/g, 'kg/m2');
  s = s.replace(/(\d+)\/mm(?!3|³|\d|Hg|\s*Hg)/g, '$1/mm3');
  s = s.replace(/\bmL\/min\/1\.73\s*m(?!2|²|\d)/g, 'mL/min/1.73 m2');
  if (s !== beforeUnits) {
    repairs.add('Restored missing exponent on unit (kg/m2 or /mm3)');
  }

  // 5. Fix broken PDF line-wrap hyphens
  const beforeHyphens = s;
  s = s.replace(/\bC\s+-reactive\b/g, 'C-reactive');
  s = s.replace(/\b(IBS|x|T|Z|B|C|D|N|Q|S|ST|J)-\s+(C|D|ray|score|type|peptide|dimer|terminal|wave|segment|point)\b/g, '$1-$2');
  s = s.replace(/\b([A-Za-z]{2,})-\s+([a-z]{2,})\b/g, (match, left, right) => {
    if (SUSPENDED_HYPHEN_FOLLOWERS.has(right.toLowerCase())) {
      return match;
    }
    return `${left}-${right}`;
  });
  if (s !== beforeHyphens) {
    repairs.add('Rejoined hyphenated word split across lines');
  }

  // 6. Explanation-specific cleanup (stray page numbers and Ref: block separation)
  if (options.isExplanation && s.includes('Ref:')) {
    const beforeRef = s;
    s = s.replace(/\.\s+\d{1,3}\s+(?=Ref:)/g, '. ');
    s = s.replace(/(\.\s*)\s+\d{1,3}$/g, '$1');
    s = s.replace(/\s*\bRef:\s*/g, '\n\nRef: ');
    if (s !== beforeRef) {
      repairs.add('Formatted Ref: citation block');
    }
  }

  // 7. Residual quality warnings for human review
  if (/[\uE000-\uF8FF]/.test(s)) {
    warnings.add('Contains unmapped Private Use Unicode character (possible PDF symbol artifact)');
  }
  if (/(?:^|\s)-[a-z]{3,}/i.test(s)) {
    warnings.add('Contains word starting with a dangling hyphen (possible dropped Greek letter α/β/γ)');
  }
  const openParens = (s.match(/\(/g) || []).length;
  const closeParens = (s.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    warnings.add(`Unbalanced parentheses (${openParens} open vs ${closeParens} close)`);
  }

  return {
    text: s.trim(),
    repairs: Array.from(repairs),
    warnings: Array.from(warnings),
  };
}

/**
 * Sanitizes and formats a question stem, preserving embedded HTML tables (`<div...`)
 * and structuring `Laboratory Findings` blocks, colon-introduced lists, and the
 * final "Which one of the following..." prompt onto clean lines.
 */
export function sanitizeQuestionText(raw: string): SanitizeTextResult {
  if (!raw) return { text: '', repairs: [], warnings: [] };

  const divIdx = raw.indexOf('<div');
  const textPart = divIdx !== -1 ? raw.substring(0, divIdx) : raw;
  const htmlPart = divIdx !== -1 ? raw.substring(divIdx).trim() : '';

  // Preserve intentional newlines if the author already formatted the stem with line breaks
  const hasExistingNewlines = textPart.trim().includes('\n');
  const base = repairCharactersAndSpacing(textPart, {
    isExplanation: false,
    preserveNewlines: hasExistingNewlines,
  });

  let s = base.text;
  const repairs = new Set<string>(base.repairs);
  const warnings = new Set<string>(base.warnings);

  const beforeStructure = s;
  const hasLabHeading = s.includes('Laboratory Findings');
  const hasColonList = /(?:following|following results|include|findings include|medications):/i.test(s);

  if (hasLabHeading || hasColonList) {
    // 1. Put Laboratory Findings on its own block
    s = s.replace(/\s*(Laboratory Findings)\s+/g, '\n\n$1\n');

    // 2. Put newline after list-introducing colons
    s = s.replace(
      /(following:|following results:|medications:|current medications include:|Laboratory findings include:)\s+/gi,
      '$1\n'
    );

    // 3. Split inline lab items that have reference ranges `(N ...)`
    s = s.replace(/(\(N\s+[^)]+\))\s+(?=[A-Z])/g, '$1\n');

    // 4. Split common un-ranged lab items when listed inline
    s = s.replace(
      /(Serum glucose \d+ mg\/dL|Glucose \d+ mg\/dL|Pleural fluid protein [\d.]+ g\/dL|Pleural fluid LDH \d+ IU\/L|Pleural fluid glucose \d+ mg\/dL|Total cholesterol \d+ mg\/dL|HDL-cholesterol \d+ mg\/dL|LDL-cholesterol \d+ mg\/dL|Triglycerides \d+ mg\/dL|Hemoglobin A1c [\d.]+%|Estimated glomerular filtration rate \d+ mL\/min\/1\.73 m2|CBC normal|Urine hCG negative|Urine dipstick 2\+ urobilinogen|Lipase normal|Urine ketones trace|Arterial pH [\d.]+|Anion gap normal|Urine ketones 4\+|Urine glucose 4\+|Antimitochondrial antibodies positive)\s+(?=[A-Z])/g,
      '$1\n'
    );

    // 5. Add blank line after a lab/medication list when narrative prose resumes
    s = s.replace(
      /\n(Her vital signs|His vital signs|On examination|The patient|You tell|A peripheral smear|Her calculated|His calculated|An examination|He currently walks|She currently walks)/g,
      '\n\n$1'
    );
  }

  // Separate final standalone question sentence ("Which one of the following...") with a blank line
  s = s.replace(/(?:([.!?"])\s+|\n)(Which (?:one )?of the following)/g, '$1\n\n$2');
  s = s.replace(/\n{3,}/g, '\n\n').trim();

  if (s !== beforeStructure) {
    repairs.add('Formatted lab findings / lead-in prompt line breaks');
  }

  const finalText = htmlPart ? `${s}\n\n${htmlPart}` : s;

  return {
    text: finalText,
    repairs: Array.from(repairs),
    warnings: Array.from(warnings),
  };
}

/**
 * Sanitizes an answer option, stripping redundant leading letter prefixes ("A) ", "B. ")
 * and repairing character-level artifacts.
 */
export function sanitizeOptionText(raw: string): SanitizeTextResult {
  if (!raw) return { text: '', repairs: [], warnings: [] };

  let trimmed = raw.trim();
  const prefixMatch = trimmed.match(/^[A-E][.)]\s+/);
  let strippedPrefix = false;
  if (prefixMatch) {
    trimmed = trimmed.slice(prefixMatch[0].length).trim();
    strippedPrefix = true;
  }

  const res = repairCharactersAndSpacing(trimmed, { isExplanation: false, preserveNewlines: false });
  if (strippedPrefix) {
    res.repairs.unshift('Stripped duplicate option letter prefix (A-E)');
  }
  return res;
}

/**
 * Sanitizes an explanation, preserving paragraph breaks and separating `Ref:` citations.
 */
export function sanitizeExplanationText(raw: string): SanitizeTextResult {
  if (!raw) return { text: '', repairs: [], warnings: [] };
  const hasExistingNewlines = raw.trim().includes('\n');
  return repairCharactersAndSpacing(raw, {
    isExplanation: true,
    preserveNewlines: hasExistingNewlines,
  });
}

/**
 * Sanitizes all text fields of a question row at once and aggregates repairs & warnings.
 */
export function sanitizeQuestionFields(input: {
  question_text: string;
  options: string[];
  explanation: string;
}): SanitizeQuestionResult {
  const qRes = sanitizeQuestionText(input.question_text);
  const optResults = input.options.map(o => sanitizeOptionText(o));
  const expRes = sanitizeExplanationText(input.explanation);

  const repairs = new Set<string>([
    ...qRes.repairs,
    ...optResults.flatMap(r => r.repairs),
    ...expRes.repairs,
  ]);

  const warnings = new Set<string>([
    ...qRes.warnings.map(w => `Question stem: ${w}`),
    ...optResults.flatMap((r, idx) =>
      r.warnings.map(w => `Option ${String.fromCharCode(65 + idx)}: ${w}`)
    ),
    ...expRes.warnings.map(w => `Explanation: ${w}`),
  ]);

  return {
    question_text: qRes.text,
    options: optResults.map(r => r.text),
    explanation: expRes.text,
    repairs: Array.from(repairs),
    warnings: Array.from(warnings),
  };
}
