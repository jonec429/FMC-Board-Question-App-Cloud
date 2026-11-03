/**
 * Time Zone Management Utilities for FMC Board Prep.
 * 
 * Central Source of Truth for all Eastern Time (ET / America/New_York)
 * date, time, cutoff, and schedule calculations.
 * 
 * Automatically and seamlessly handles both:
 *   - Eastern Daylight Time (EDT = UTC-4, summer / early Nov)
 *   - Eastern Standard Time (EST = UTC-5, winter / early March)
 * 
 * Uses standard Intl.DateTimeFormat with 'America/New_York' so calculations
 * are 100% immune to DST shifts, server execution timezone (UTC on Vercel),
 * and client/device local timezones.
 */

export const EASTERN_TIMEZONE = 'America/New_York';

export interface EasternDateParts {
  year: number;
  month: number;    // 1-12
  day: number;      // 1-31
  hour: number;     // 0-23 (strict 24-hour cycle)
  minute: number;   // 0-59
  second: number;   // 0-59
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
}

/**
 * Parses any valid Date or timestamp into exact Eastern Time components.
 */
export function getEasternDateParts(input: Date | string | number = new Date()): EasternDateParts {
  const date = typeof input === 'string' || typeof input === 'number' ? new Date(input) : input;
  const validDate = isNaN(date.getTime()) ? new Date() : date;

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN_TIMEZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    weekday: 'short'
  });

  const parts = formatter.formatToParts(validDate);
  const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0', 10);
  const weekdayStr = parts.find(p => p.type === 'weekday')?.value || '';

  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
  };

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
    dayOfWeek: dayMap[weekdayStr] ?? validDate.getUTCDay()
  };
}

/**
 * Returns today's date (or input date) as a 'YYYY-MM-DD' string strictly in Eastern Time.
 * Uses 'en-CA' formatting which produces ISO 'YYYY-MM-DD' without string parsing.
 */
export function getEasternDateString(input: Date | string | number = new Date()): string {
  const date = typeof input === 'string' || typeof input === 'number' ? new Date(input) : input;
  const validDate = isNaN(date.getTime()) ? new Date() : date;

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: EASTERN_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(validDate);
}

/**
 * Returns the Eastern time formatted as 'HH:MM' (24-hour, zero-padded).
 */
export function getEasternTimeString(input: Date | string | number = new Date()): string {
  const { hour, minute } = getEasternDateParts(input);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * Returns the Eastern time formatted for display (e.g., '12:30 PM').
 */
export function getEasternTimeDisplay(input: Date | string | number = new Date()): string {
  const date = typeof input === 'string' || typeof input === 'number' ? new Date(input) : input;
  const validDate = isNaN(date.getTime()) ? new Date() : date;

  return new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(validDate);
}

/**
 * Returns the current Eastern time zone abbreviation ('EST' or 'EDT')
 * dynamically based on whether Daylight Saving Time is active.
 */
export function getEasternTzAbbreviation(input: Date | string | number = new Date()): string {
  const date = typeof input === 'string' || typeof input === 'number' ? new Date(input) : input;
  const validDate = isNaN(date.getTime()) ? new Date() : date;

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN_TIMEZONE,
    timeZoneName: 'short'
  }).formatToParts(validDate);

  const tz = parts.find(p => p.type === 'timeZoneName')?.value;
  return tz || 'ET';
}

/**
 * Returns true if the Eastern Time is past 12:30 PM (12:30:00 or later).
 * This controls the Question of the Day unlock (revealing the answer, explanation, and stats).
 * 
 * Uses strict h23 hour cycle so midnight (00:00) is NEVER misread as 24:00.
 */
export function isPastNoonEastern(input: Date | string | number = new Date()): boolean {
  const { hour, minute } = getEasternDateParts(input);
  if (hour > 12) return true;
  if (hour === 12 && minute >= 30) return true;
  return false;
}

/**
 * Helper to check if current Eastern time is within a specified window.
 */
export function isEasternTimeInRange(
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number,
  input: Date | string | number = new Date()
): boolean {
  const { hour, minute } = getEasternDateParts(input);
  const currentTotal = hour * 60 + minute;
  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;
  return currentTotal >= startTotal && currentTotal <= endTotal;
}

/**
 * "Just in Time" badge window: answered between 12:25 PM and 12:29 PM Eastern Time,
 * in the final 5 minutes before the 12:30 PM answer unlock.
 */
export function isJustInTimeEastern(input: Date | string | number = new Date()): boolean {
  return isEasternTimeInRange(12, 25, 12, 29, input);
}

/**
 * "Early Bird" badge condition: answered before 7:00 AM Eastern Time.
 */
export function isEarlyBirdEastern(input: Date | string | number = new Date()): boolean {
  const { hour } = getEasternDateParts(input);
  return hour < 7;
}

/**
 * Returns true if the Eastern day of the week is Saturday or Sunday.
 */
export function isWeekendEastern(input: Date | string | number = new Date()): boolean {
  const { dayOfWeek } = getEasternDateParts(input);
  return dayOfWeek === 0 || dayOfWeek === 6;
}

/**
 * Calculates the upcoming Sunday date ('YYYY-MM-DD') in Eastern Time.
 * If today is Sunday, returns today's date.
 * If today is Thursday (when block reminder crons run), returns the upcoming Sunday (3 days away).
 */
export function getEasternUpcomingSunday(input: Date | string | number = new Date()): string {
  const parts = getEasternDateParts(input);
  const dow = parts.dayOfWeek; // 0 = Sun, 1 = Mon, ..., 4 = Thu, ..., 6 = Sat
  const daysUntilSunday = (7 - dow) % 7;

  // Anchoring at noon (12:00:00) prevents any DST 23h/25h day-skipping artifacts
  const noonDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + daysUntilSunday, 12, 0, 0));
  return getEasternDateString(noonDate);
}

/**
 * Safely computes the difference in whole calendar days (dateB - dateA)
 * between two 'YYYY-MM-DD' date strings.
 * Anchors at 12:00 UTC so it is 100% immune to DST clock changes.
 */
export function getCalendarDaysDiff(dateStrA: string, dateStrB: string): number {
  const [ya, ma, da] = dateStrA.split('-').map(Number);
  const [yb, mb, db] = dateStrB.split('-').map(Number);

  const utcA = Date.UTC(ya, ma - 1, da, 12, 0, 0);
  const utcB = Date.UTC(yb, mb - 1, db, 12, 0, 0);

  return Math.round((utcB - utcA) / (1000 * 60 * 60 * 24));
}

/**
 * Creates a Date object representing the Eastern wall-clock values
 * for backward compatibility with legacy consumers expecting a Date.
 */
export function getESTDate(input: Date | string | number = new Date()): Date {
  const { year, month, day, hour, minute, second } = getEasternDateParts(input);
  return new Date(year, month - 1, day, hour, minute, second);
}
