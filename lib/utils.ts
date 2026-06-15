/**
 * Shared utility functions for the FMC Board Review App application.
 */

/**
 * Formats a full name into the professional "Dr. First Last" display format.
 * Used across the Dashboard, Leaderboard, Admin Console, and Performance views.
 * Showing the full name (vs. just the last name) helps disambiguate residents
 * who share a last name.
 *
 * @param fullName - The full name string (e.g., "Jonathan Carbungco")
 * @returns Formatted display name (e.g., "Dr. Jonathan Carbungco"), or "Unknown" if no name provided.
 */
export function formatDisplayName(fullName?: string | null): string {
  if (!fullName || fullName.trim().length === 0) return 'Unknown';
  return `Dr. ${fullName.trim().replace(/\s+/g, ' ')}`;
}

/**
 * Formats a name as "Last, First" for sortable admin tables, so that a sort by
 * last name reads correctly at a glance. Prefers the explicit last-name field
 * when given (handles two-part surnames like "Dela Cruz"); otherwise falls back
 * to treating the final token of the full name as the last name.
 *
 * @param fullName - Full name (e.g., "Angela Nguyen")
 * @param lastNameField - The known last name, if available (e.g., "Nguyen")
 * @returns "Nguyen, Angela", or "Unknown" if no name provided.
 */
export function formatLastNameFirst(fullName?: string | null, lastNameField?: string | null): string {
  const full = (fullName || '').trim().replace(/\s+/g, ' ');
  if (!full) return 'Unknown';
  let last = (lastNameField || '').trim();
  let first = '';
  if (last && full.toLowerCase().endsWith(last.toLowerCase())) {
    first = full.slice(0, full.length - last.length).trim();
  } else {
    const parts = full.split(' ');
    if (parts.length < 2) return full;
    last = parts[parts.length - 1];
    first = parts.slice(0, -1).join(' ');
  }
  return first ? `${last}, ${first}` : last;
}

/**
 * Wraps a promise with a timeout. If the promise does not resolve within
 * the specified milliseconds, it rejects with a timeout error.
 * Used to prevent infinite spinners when Supabase or network requests hang.
 */
export function withTimeout<T>(promise: Promise<T> | PromiseLike<T>, ms: number = 30000): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Request timed out. Please check your connection.')), ms)
  );
  return Promise.race([promise as Promise<T>, timeout]);
}

/**
 * Retries a promise-returning function with exponential backoff.
 * Useful for handling transient network errors or Supabase downtime.
 *
 * @param operation - The async function to retry
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param baseDelayMs - Base delay in milliseconds (default: 1000)
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (error: unknown) {
      attempt++;
      if (attempt > maxRetries) {
        throw error;
      }
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.warn(`[withRetry] Attempt ${attempt} failed. Retrying in ${delay}ms...`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

