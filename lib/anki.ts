import { QuestionAttempt, Question } from '@/lib/types';
import { supabase } from './supabase';

function escapeCsv(field: string): string {
  if (!field) return '';
  // Convert newlines to HTML <br> tags for Anki compatibility
  let processed = field.replace(/\r?\n/g, '<br>');
  // Escape double quotes by doubling them
  processed = processed.replace(/"/g, '""');
  // Wrap the entire field in double quotes
  return `"${processed}"`;
}

export async function exportIncorrectToAnki(userId: string): Promise<string> {
  // Fetch incorrect question attempts along with the associated question data
  const { data: attempts, error } = await supabase
    .from('question_attempts')
    .select('*, questions(*)')
    .eq('user_id', userId)
    .eq('is_correct', false);

  if (error) {
    console.error('Error fetching incorrect questions:', error);
    throw new Error('Failed to fetch incorrect questions');
  }

  if (!attempts || attempts.length === 0) {
    return ''; // No incorrect questions
  }

  // Deduplicate by question ID so we don't have multiple cards for the same question
  const uniqueQuestions = new Map<string, Question>();
  attempts.forEach((attempt: QuestionAttempt & { questions?: Question | Question[] | null }) => {
    if (attempt.questions) {
      uniqueQuestions.set(attempt.question_id, (Array.isArray(attempt.questions) ? attempt.questions[0] : attempt.questions) as Question);
    }
  });

  // Generate CSV rows
  let csvContent = '';
  
  // No header row, Anki usually expects raw data
  
  uniqueQuestions.forEach((q) => {
    // Column 1: Front (Stem + Options)
    let front = q.question_text || '';
    if (q.options && q.options.length > 0) {
      front += '<br><br><b>Options:</b><br>';
      q.options.forEach((opt, idx) => {
        front += `${String.fromCharCode(65 + idx)}. ${opt}<br>`;
      });
    }

    // Column 2: Back (Answer + Explanation)
    let back = '';
    if (q.options && typeof q.correct_index === 'number') {
      back += `<b>Correct Answer:</b> ${String.fromCharCode(65 + q.correct_index)}. ${q.options[q.correct_index]}<br><br>`;
    }
    if (q.explanation) {
      back += `<b>Explanation:</b><br>${q.explanation}`;
    }

    // Column 3: Tags (Category / Keyword)
    // Anki tags are space-separated. Replace spaces in categories with underscores.
    const tags = [];
    if (q.category) {
      tags.push(q.category.replace(/\s+/g, '_'));
    }
    const tagsStr = tags.join(' ');

    const row = [escapeCsv(front), escapeCsv(back), escapeCsv(tagsStr)].join(',');
    csvContent += row + '\n';
  });

  return csvContent;
}

export function downloadCsv(filename: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}



