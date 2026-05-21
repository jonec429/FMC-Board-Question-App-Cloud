import { supabase } from './supabase';
import { getCurrentAcademicYear } from './academicYear';

/**
 * Helper to get the current date explicitly in EST
 */
export function getESTDate(date: Date = new Date()): Date {
  return new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
}

/**
 * Calculates the deterministic index of the QOTD based on the number of weekdays
 * since July 1st of the current academic year.
 */
export function getQotdIndex(date: Date = new Date()): number | null {
  const estDate = getESTDate(date);
  const dayOfWeek = estDate.getDay();
  // 0 = Sunday, 6 = Saturday
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return null; // No QOTD on weekends
  }

  const academicYear = getCurrentAcademicYear();
  // July 1st of the starting year of the academic year
  // (e.g., if academicYear is 2026, the year started July 1, 2025)
  const startDate = new Date(academicYear - 1, 6, 1); // Month is 0-indexed (6 = July)
  
  // Strip time for accurate day counting
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const current = new Date(estDate.getFullYear(), estDate.getMonth(), estDate.getDate());

  let weekdays = 0;
  const tempDate = new Date(start);

  while (tempDate <= current) {
    const day = tempDate.getDay();
    if (day !== 0 && day !== 6) {
      weekdays++;
    }
    tempDate.setDate(tempDate.getDate() + 1);
  }

  // Returns 0-indexed offset (e.g. 1st weekday = 0)
  return Math.max(0, weekdays - 1);
}

/**
 * Fetches the specific question for the day directly from Supabase.
 */
export async function getQotdQuestion() {
  const index = getQotdIndex();
  if (index === null) return null; // Weekend

  // Fetch the Nth question, ordered by year DESC and id ASC
  // Excluding Demo questions
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .neq('year', 'Demo')
    .neq('category', 'Demo')
    .not('id', 'in', '("00000000-0000-0000-0000-000000000001","00000000-0000-0000-0000-000000000002","00000000-0000-0000-0000-000000000003")')
    .order('year', { ascending: false })
    .order('id', { ascending: true })
    .range(index, index)
    .single();

  if (error || !data) {
    console.error('Error fetching QOTD:', error);
    return null;
  }

  return data;
}

/**
 * Returns true if the current time is past 12:00 PM Eastern Time.
 */
export function isPastNoon(date: Date = new Date()): boolean {
  // Get time in Eastern Time
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    hour12: false
  });
  
  const currentHour = parseInt(formatter.format(date), 10);
  return currentHour >= 12;
}

/**
 * Helper to get today's date string (YYYY-MM-DD) in local time (EST)
 */
export function getTodayDateString(date: Date = new Date()): string {
  const estDate = getESTDate(date);
  return `${estDate.getFullYear()}-${String(estDate.getMonth() + 1).padStart(2, '0')}-${String(estDate.getDate()).padStart(2, '0')}`;
}
