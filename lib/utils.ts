/**
 * Shared utility functions for the FMC QBank Cloud application.
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
    } catch (error: any) {
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
