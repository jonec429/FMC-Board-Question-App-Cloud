/**
 * CSV Import utilities for the FMC Board Review App Question Importer.
 *
 * Designed for the annual ITE workflow:
 *   1. Use Gemini (or any AI) to scrape questions from a PDF into CSV rows.
 *   2. Paste / upload the CSV into the Admin Console.
 *   3. The parser + validator below catches structural errors before they hit Supabase.
 *
 * No external dependencies — hand-rolled CSV parser handles quoted fields,
 * embedded commas, embedded newlines (within quotes), and doubled-quote escapes.
 */

// === Canonical category list (matches what's in the live questions table) ===
export const CANONICAL_CATEGORIES = [
  'Cardiovascular',
  'Endocrine',
  'Gastrointestinal',
  'Hematologic/Immune',
  'Infectious Disease',
  'Musculoskeletal',
  'Nephrologic',
  'Neurologic',
  'Population Health/Epidemiology',
  'Psychiatric/Behavioral',
  'Pulmonary',
  'Reproductive/Female',
  'Reproductive/Male',
  'Skin/Subcutaneous',
  'Special Sensory',
] as const;

export type CanonicalCategory = typeof CANONICAL_CATEGORIES[number];

// Common AI/human misspellings → canonical name. Lower-case keys.
const CATEGORY_ALIASES: Record<string, CanonicalCategory> = {
  'cardio': 'Cardiovascular',
  'cardiology': 'Cardiovascular',
  'gi': 'Gastrointestinal',
  'heme': 'Hematologic/Immune',
  'hematology': 'Hematologic/Immune',
  'hematologic': 'Hematologic/Immune',
  'id': 'Infectious Disease',
  'infectious': 'Infectious Disease',
  'msk': 'Musculoskeletal',
  'ortho': 'Musculoskeletal',
  'renal': 'Nephrologic',
  'nephrology': 'Nephrologic',
  'neuro': 'Neurologic',
  'neurology': 'Neurologic',
  'pop health': 'Population Health/Epidemiology',
  'epidemiology': 'Population Health/Epidemiology',
  'psych': 'Psychiatric/Behavioral',
  'psychiatry': 'Psychiatric/Behavioral',
  'behavioral': 'Psychiatric/Behavioral',
  'pulm': 'Pulmonary',
  'respiratory': 'Pulmonary',
  'pulmonology': 'Pulmonary',
  'ob': 'Reproductive/Female',
  'obgyn': 'Reproductive/Female',
  'ob/gyn': 'Reproductive/Female',
  'gyn': 'Reproductive/Female',
  'female': 'Reproductive/Female',
  'male': 'Reproductive/Male',
  'derm': 'Skin/Subcutaneous',
  'dermatology': 'Skin/Subcutaneous',
  'skin': 'Skin/Subcutaneous',
  'integumentary': 'Skin/Subcutaneous',
  'eent': 'Special Sensory',
  'ent': 'Special Sensory',
  'ophthalmology': 'Special Sensory',
  'ophtho': 'Special Sensory',
  'ophthalmologic': 'Special Sensory',
  'sensory': 'Special Sensory',
};

/**
 * Resolves a user-supplied category to its canonical form.
 * Returns the canonical string when matched, or null when ambiguous/unknown.
 */
export function resolveCategory(raw: string): CanonicalCategory | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  // Exact match (case-sensitive) is the happy path
  if ((CANONICAL_CATEGORIES as readonly string[]).includes(trimmed)) {
    return trimmed as CanonicalCategory;
  }
  // Case-insensitive exact match
  const lower = trimmed.toLowerCase();
  const ci = CANONICAL_CATEGORIES.find(c => c.toLowerCase() === lower);
  if (ci) return ci;
  // Alias lookup
  return CATEGORY_ALIASES[lower] || null;
}

/**
 * Converts a correct-answer letter (A, B, C, D, E) to a zero-based index.
 * Also accepts numeric strings if a CSV row already has the index.
 */
export function letterToIndex(raw: string): number | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (trimmed.length === 0) return null;
  // Numeric input
  if (/^\d+$/.test(trimmed)) {
    const n = parseInt(trimmed, 10);
    return Number.isFinite(n) ? n : null;
  }
  const upper = trimmed.toUpperCase().charAt(0);
  if (upper >= 'A' && upper <= 'Z') {
    return upper.charCodeAt(0) - 'A'.charCodeAt(0);
  }
  return null;
}

// === CSV Parsing ============================================================

/**
 * Parses a CSV string into an array of rows.
 * Handles:
 *   - Quoted fields ("hello, world")
 *   - Embedded newlines inside quotes
 *   - Doubled-quote escapes ("She said ""hi""")
 *   - Trailing newlines
 * Does not handle tabs as separators (TSV) — pass a tab-prefixed delimiter if needed later.
 */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          // Escaped double quote
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
        continue;
      }
      if (ch === ',') {
        row.push(field);
        field = '';
        i++;
        continue;
      }
      if (ch === '\r') {
        // Skip standalone CR (paired with LF below)
        i++;
        continue;
      }
      if (ch === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
        i++;
        continue;
      }
      field += ch;
      i++;
    }
  }

  // Flush any trailing field/row
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

// === Question Row Validation =================================================

export interface ParsedQuestion {
  year: string;
  category: CanonicalCategory;
  system: string;
  question_text: string;
  options: string[];
  correct_index: number;
  explanation: string;
  resource_link: string;
}

export interface RowResult {
  /** 1-based line number from the original CSV (header counts as line 1) */
  line: number;
  /** Raw header→value mapping for debugging */
  raw: Record<string, string>;
  question?: ParsedQuestion;
  errors: string[];
  warnings: string[];
}

const REQUIRED_HEADERS = [
  'category',
  'question_text',
  'option_a',
  'option_b',
  'option_c',
  'option_d',
  'correct',
];

/**
 * Validates header row.
 * Returns `null` when valid, or an error message otherwise.
 */
export function validateHeader(header: string[]): string | null {
  if (!header || header.length === 0) return 'CSV is empty.';
  const normalized = header.map(h => h.trim().toLowerCase());
  const missing = REQUIRED_HEADERS.filter(req => !normalized.includes(req));
  if (missing.length > 0) {
    return `Missing required column(s): ${missing.join(', ')}. Required: ${REQUIRED_HEADERS.join(', ')}.`;
  }
  return null;
}

/**
 * Maps a single data row (header+values) into a validated question payload.
 */
function validateRow(headerMap: Map<string, number>, values: string[], lineNumber: number): RowResult {
  const get = (key: string): string => {
    const idx = headerMap.get(key);
    if (idx == null) return '';
    return (values[idx] || '').trim();
  };

  const raw: Record<string, string> = {};
  headerMap.forEach((idx, key) => {
    raw[key] = (values[idx] || '').trim();
  });

  const errors: string[] = [];
  const warnings: string[] = [];

  // year — optional, default to "Unspecified" if missing
  const year = get('year') || 'Unspecified';

  // category — required, resolved against canonical list
  const rawCategory = get('category');
  let category: CanonicalCategory | null = null;
  if (!rawCategory) {
    errors.push('category is required');
  } else {
    category = resolveCategory(rawCategory);
    if (!category) {
      errors.push(`Unknown category "${rawCategory}" — expected one of: ${CANONICAL_CATEGORIES.join(', ')}`);
    } else if (category !== rawCategory) {
      warnings.push(`Category normalized: "${rawCategory}" → "${category}"`);
    }
  }

  // question_text
  const question_text = get('question_text');
  if (!question_text) {
    errors.push('question_text is required');
  } else if (question_text.length < 30) {
    warnings.push(`question_text is only ${question_text.length} chars — looks truncated`);
  }

  // options — A through E, drop empties
  const optionsRaw = ['option_a', 'option_b', 'option_c', 'option_d', 'option_e']
    .map(k => get(k))
    .filter(o => o.length > 0);
  if (optionsRaw.length < 2) {
    errors.push(`At least 2 non-empty options required (found ${optionsRaw.length})`);
  }

  // correct — letter or index
  const correctRaw = get('correct');
  const correctIdx = letterToIndex(correctRaw);
  if (correctRaw === '') {
    errors.push('correct is required (use letters A, B, C, D, or E)');
  } else if (correctIdx == null) {
    errors.push(`correct value "${correctRaw}" is invalid — use A-E or 0-4`);
  } else if (correctIdx < 0 || correctIdx >= optionsRaw.length) {
    errors.push(`correct index ${correctIdx} out of range — only ${optionsRaw.length} options provided`);
  }

  // explanation / resource_link — optional
  const explanation = get('explanation');
  const resource_link = get('resource_link');
  if (!explanation) {
    warnings.push('No explanation provided — resident feedback will be limited');
  }

  if (errors.length > 0) {
    return { line: lineNumber, raw, errors, warnings };
  }

  return {
    line: lineNumber,
    raw,
    errors: [],
    warnings,
    question: {
      year,
      category: category!,
      system: category!, // mirror category to legacy system column
      question_text,
      options: optionsRaw,
      correct_index: correctIdx!,
      explanation,
      resource_link,
    },
  };
}

export interface ParseSummary {
  headerError: string | null;
  results: RowResult[];
  validCount: number;
  errorCount: number;
  warningCount: number;
}

/**
 * Top-level parse + validate. Use this from the UI; surfaces line numbers
 * matching the user's source CSV (1-based, header counted).
 */
export function parseAndValidate(text: string): ParseSummary {
  const allRows = parseCSV(text).filter(r => r.length > 0 && r.some(c => c.trim().length > 0));
  if (allRows.length === 0) {
    return {
      headerError: 'CSV is empty.',
      results: [],
      validCount: 0,
      errorCount: 0,
      warningCount: 0,
    };
  }

  const header = allRows[0].map(h => h.trim().toLowerCase());
  const headerError = validateHeader(header);
  if (headerError) {
    return {
      headerError,
      results: [],
      validCount: 0,
      errorCount: 0,
      warningCount: 0,
    };
  }

  const headerMap = new Map<string, number>();
  header.forEach((h, idx) => headerMap.set(h, idx));

  const results: RowResult[] = [];
  for (let i = 1; i < allRows.length; i++) {
    results.push(validateRow(headerMap, allRows[i], i + 1));
  }

  return {
    headerError: null,
    results,
    validCount: results.filter(r => r.errors.length === 0).length,
    errorCount: results.filter(r => r.errors.length > 0).length,
    warningCount: results.reduce((sum, r) => sum + r.warnings.length, 0),
  };
}
