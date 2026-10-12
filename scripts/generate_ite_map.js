const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const Papa = require('papaparse');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function generate() {
  const { data: dbQuestions, error } = await supabase.from('questions').select('id, year, question_text, resource_link, abfm_category');
  if (error) throw error;
  console.log('Fetched dbQuestions:', dbQuestions.length);

  const p23 = JSON.parse(fs.readFileSync('data/ITEs/parsed_2023.json', 'utf8'));
  const p24 = JSON.parse(fs.readFileSync('data/ITEs/parsed_2024.json', 'utf8'));
  const p25 = JSON.parse(fs.readFileSync('data/ITEs/parsed_2025.json', 'utf8'));

  const csvContent = fs.readFileSync('questions.csv', 'utf8');
  const { data: csvRows } = Papa.parse(csvContent, { header: true });
  const rows2025 = csvRows.filter(r => r.Year === '2025');

  const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  const numberMap = {};
  const canonicalMap = {};
  let unmapped = [];

  for (const q of dbQuestions) {
    if (q.year === 'Demo' || q.id.startsWith('00000000-0000-0000-0000-00000000000')) {
      const lastChar = q.id.slice(-1);
      const num = parseInt(lastChar, 10) || 1;
      numberMap[q.id] = num;
      canonicalMap[q.id] = `DemoQ${num}`;
      continue;
    }

    let foundNum = null;

    // Check resource_link for Item X (matches 2023 & 2024)
    if (q.resource_link) {
      const m = q.resource_link.match(/Item\s+(\d+)/i);
      if (m) {
        foundNum = parseInt(m[1], 10);
      }
    }

    // For 2025 or any other, check questions.csv
    if (!foundNum && q.year === '2025') {
      const qNorm = norm(q.question_text).slice(0, 50);
      let match = rows2025.find(r => norm(r.Question).slice(0, 50) === qNorm);
      if (!match && q.resource_link) {
        match = rows2025.find(r => r['Resource Link'] === q.resource_link);
      }
      if (match && match['Question ID']) {
        foundNum = parseInt(match['Question ID'], 10);
      }
    }

    // Fallback: match against parsed JSON for that year
    if (!foundNum && (q.year === '2023' || q.year === '2024' || q.year === '2025')) {
      const parsedYear = q.year === '2023' ? p23 : q.year === '2024' ? p24 : p25;
      const qNorm = norm(q.question_text).slice(0, 50);
      for (const [num, pq] of Object.entries(parsedYear)) {
        if (norm(pq.question).slice(0, 50) === qNorm) {
          foundNum = parseInt(num, 10);
          break;
        }
      }
    }

    // Special handling for the known repeat questions
    if (!foundNum) {
      if (q.id === 'b9d5b51f-8c32-472d-8f02-7ac394f086e1' || q.id === 'dda216f2-f1f8-4495-b597-bddab68e6b34') {
        foundNum = 127;
      } else if (q.id === '41a27c0b-06ad-4593-8c67-4a68f24399cf' || q.id === 'c60df00e-8b1d-4e35-8ed0-29c1b59348ef') {
        foundNum = 115;
      }
    }

    if (foundNum) {
      numberMap[q.id] = foundNum;
      const yr = q.year || '2025';
      canonicalMap[q.id] = `ITE${yr}Q${foundNum}`;
    } else {
      unmapped.push(q);
    }
  }

  console.log('Total number mapped:', Object.keys(numberMap).length);
  console.log('Total canonical mapped:', Object.keys(canonicalMap).length);
  console.log('Sample mapped 2025 Item 64:', canonicalMap['ed10f7fd-aaac-4fd5-b38d-098c960ff658']);

  // Write TypeScript file
  const tsContent = `// Auto-generated mapping from question UUID to original ITE exam Item # and Canonical ITE ID (e.g. ITE2025Q64, DemoQ1)

export const ITE_QUESTION_MAP: Record<string, number> = ${JSON.stringify(numberMap, null, 2)};

export const ITE_CANONICAL_ID_MAP: Record<string, string> = ${JSON.stringify(canonicalMap, null, 2)};

/**
 * Returns the official ITE exam Item # / Question ID for a given question.
 * Fallbacks to extracting from resource_link (e.g. "Item 147") or null if unmapped.
 */
export function getQuestionExamNumber(question?: {
  id?: string;
  year?: string | null;
  resource_link?: string | null;
}): number | null {
  if (!question) return null;

  if (question.id && ITE_QUESTION_MAP[question.id]) {
    return ITE_QUESTION_MAP[question.id];
  }

  if (question.resource_link) {
    const m = question.resource_link.match(/Item\\s+(\\d+)/i);
    if (m) {
      const parsed = parseInt(m[1], 10);
      if (!isNaN(parsed)) return parsed;
    }
  }

  return null;
}

/**
 * Formats the combined ITE ID string (e.g. "ITE2025Q15", "ITE2025Q64", "DemoQ1").
 * Gracefully falls back if question year/number cannot be resolved.
 */
export function formatIteId(question?: {
  id?: string;
  year?: string | null;
  resource_link?: string | null;
  is_repeat?: boolean | null;
}): string {
  if (!question) return '';

  // Direct lookup from pre-compiled canonical map
  if (question.id && ITE_CANONICAL_ID_MAP[question.id]) {
    return ITE_CANONICAL_ID_MAP[question.id];
  }

  // Handle Demo
  if (question.year === 'Demo' || question.id?.startsWith('00000000-0000-0000-0000-00000000000')) {
    const num = getQuestionExamNumber(question);
    return num ? \`DemoQ\${num}\` : 'DemoQ1';
  }

  // Handle dynamic / newly ingested questions
  const examNum = getQuestionExamNumber(question);
  if (examNum !== null) {
    const yr = question.year ? question.year.trim() : '';
    return yr ? \`ITE\${yr}Q\${examNum}\` : \`ITEQ\${examNum}\`;
  }

  return question.id || '';
}
`;

  fs.writeFileSync('lib/iteQuestionMap.ts', tsContent, 'utf8');
  console.log('Successfully updated lib/iteQuestionMap.ts');
}

generate();
