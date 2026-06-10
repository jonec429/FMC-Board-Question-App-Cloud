/**
 * Question filtering utilities for the FMC Board Review App application.
 *
 * Board-prep best practice is to study the most recent 3 ITE years — older
 * questions may reference superseded guidelines. This module defines that
 * window and provides helpers used by the Custom Builder, Block Builder,
 * and any future Browse UI.
 *
 * The DB is not modified — older questions remain in the `questions` table
 * with their original `year`. We only filter at presentation/build time, and
 * residents/admins can opt-in to "legacy" years with an explicit warning.
 */

// Window size for "recent" ITE questions — change here to bump cohort policy.
export const RECENT_ITE_YEAR_WINDOW = 3;

// Standard warning copy. Use this everywhere we surface a legacy opt-in.
export const LEGACY_WARNING_TITLE = 'Show questions older than 3 years?';
export const LEGACY_WARNING_BODY =
  'Using ITE questions more than 3 years old may not reflect current guidelines or recommendations. ' +
  'Older questions can be useful for breadth, but answer keys may reference superseded recommendations. ' +
  'Are you sure?';

/**
 * Sorts year strings in descending order (most recent first).
 * Treats them as strings to handle non-numeric values like "Unspecified" safely
 * (those sort to the end alphabetically — fine for our purposes).
 */
export function sortYearsDesc(years: (string | null | undefined)[]): string[] {
  const cleaned = years.filter((y): y is string => !!y && y.trim().length > 0);
  return Array.from(new Set(cleaned)).sort().reverse();
}

/**
 * Returns the most recent N ITE years from a pool of available years.
 * Used as the default selection for "recent" questions.
 */
export function getRecentITEYears(allYears: (string | null | undefined)[], n: number = RECENT_ITE_YEAR_WINDOW): string[] {
  return sortYearsDesc(allYears).slice(0, n);
}

/**
 * Returns years older than the recent-N window — i.e. the "legacy" set.
 */
export function getLegacyITEYears(allYears: (string | null | undefined)[], n: number = RECENT_ITE_YEAR_WINDOW): string[] {
  return sortYearsDesc(allYears).slice(n);
}

/**
 * Quick check: is this year considered "recent" given the available pool?
 */
export function isRecentITEYear(year: string, allYears: (string | null | undefined)[], n: number = RECENT_ITE_YEAR_WINDOW): boolean {
  return getRecentITEYears(allYears, n).includes(year);
}

/**
 * Splits a list of years into { recent, legacy } buckets, ordered descending.
 * Convenience helper for UI rendering.
 */
export function partitionYears(allYears: (string | null | undefined)[], n: number = RECENT_ITE_YEAR_WINDOW): { recent: string[]; legacy: string[] } {
  const sorted = sortYearsDesc(allYears);
  return {
    recent: sorted.slice(0, n),
    legacy: sorted.slice(n),
  };
}
