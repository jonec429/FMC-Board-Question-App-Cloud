import { Question } from '@/lib/types';
import { supabase } from './supabase';

/**
 * Escapes a field for standard CSV formatting and HTML Anki cards:
 * - Converts newlines to <br>
 * - Escapes double quotes by doubling them
 * - Wraps the field in quotes
 */
function escapeCsv(field: string | null | undefined): string {
  if (!field) return '""';
  let processed = String(field).replace(/\r?\n/g, '<br>');
  processed = processed.replace(/"/g, '""');
  return `"${processed}"`;
}

/**
 * Generates an Anki-compatible CSV string from a list of questions.
 * Includes directives for Anki's CSV importer to recognize commas, HTML formatting, and tags.
 */
export function generateAnkiCsv(questions: Question[]): string {
  if (!questions || questions.length === 0) {
    return '';
  }

  // Anki file headers for automated import configuration
  let csvContent = '#separator:Comma\n#html:true\n#tags column:3\n';

  questions.forEach((q) => {
    // Safely parse options (can be Array or JSON string)
    let opts: string[] = [];
    if (Array.isArray(q.options)) {
      opts = q.options;
    } else if (typeof q.options === 'string') {
      try {
        opts = JSON.parse(q.options);
      } catch {
        opts = [];
      }
    }

    // Column 1: Front (Stem + Options)
    let front = q.question_text || '';
    if (opts.length > 0) {
      front += '<br><br><b>Options:</b><br>';
      opts.forEach((opt, idx) => {
        front += `${String.fromCharCode(65 + idx)}. ${opt}<br>`;
      });
    }

    // Column 2: Back (Correct Answer + Explanation + Citation)
    let back = '';
    if (typeof q.correct_index === 'number' && opts[q.correct_index] !== undefined) {
      back += `<b>Correct Answer:</b> ${String.fromCharCode(65 + q.correct_index)}. ${opts[q.correct_index]}<br><br>`;
    }
    if (q.explanation) {
      back += `<b>Explanation:</b><br>${q.explanation}`;
    }
    if (q.resource_link) {
      back += `<br><br><small><b>Resource:</b> ${q.resource_link}</small>`;
    }

    // Column 3: Tags (space-separated; spaces inside tag names converted to underscores)
    const tags = ['FMC_Board_Prep'];
    if (q.category) {
      tags.push(q.category.trim().replace(/\s+/g, '_'));
    }
    if (q.system && q.system !== q.category) {
      tags.push(q.system.trim().replace(/\s+/g, '_'));
    }
    if (q.year) {
      tags.push(`ITE_${String(q.year).trim().replace(/\s+/g, '_')}`);
    }
    const tagsStr = tags.join(' ');

    const row = [escapeCsv(front), escapeCsv(back), escapeCsv(tagsStr)].join(',');
    csvContent += row + '\n';
  });

  return csvContent;
}

/**
 * Synchronously generates an Anki CSV from an existing array of questions.
 */
export function exportQuestionsToAnki(questions: Question[]): string {
  return generateAnkiCsv(questions);
}

/**
 * Fetches incorrect attempts for the given user, looks up the corresponding questions,
 * and generates an Anki CSV export.
 */
export async function exportIncorrectToAnki(userId: string, category?: string): Promise<string> {
  // Step 1: Fetch incorrect attempts for the user
  const { data: attempts, error: attemptsError } = await supabase
    .from('question_attempts')
    .select('question_id, is_correct, created_at')
    .eq('user_id', userId)
    .eq('is_correct', false);

  if (attemptsError) {
    console.error('Error fetching incorrect attempts:', attemptsError);
    throw new Error('Failed to fetch incorrect questions');
  }

  if (!attempts || attempts.length === 0) {
    return '';
  }

  // Deduplicate question IDs
  const questionIds = Array.from(new Set(attempts.map((a) => a.question_id).filter(Boolean)));
  if (questionIds.length === 0) {
    return '';
  }

  // Step 2: Fetch question details in batches of 50 to avoid GET URL query parameter limits
  const BATCH_SIZE = 50;
  const questions: Question[] = [];

  for (let i = 0; i < questionIds.length; i += BATCH_SIZE) {
    const batch = questionIds.slice(i, i + BATCH_SIZE);
    let query = supabase.from('questions').select('*').in('id', batch);
    if (category) {
      query = query.eq('category', category);
    }
    const { data: qBatch, error: qError } = await query;
    if (qError) {
      console.error('Error fetching questions batch:', qError);
      throw new Error('Failed to fetch questions');
    }
    if (qBatch) {
      questions.push(...(qBatch as any));
    }
  }

  if (questions.length === 0) {
    return '';
  }

  return generateAnkiCsv(questions);
}

/**
 * Triggers a browser download of the CSV content with UTF-8 BOM encoding.
 */
export function downloadCsv(filename: string, csvContent: string) {
  // Prepend \uFEFF BOM to ensure Excel and Anki render UTF-8 characters cleanly
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

