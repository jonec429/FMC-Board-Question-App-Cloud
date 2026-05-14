/**
 * Shared utility functions for the FMC QBank Cloud application.
 */

/**
 * Formats a full name into the professional "Dr. LastName" display format.
 * Used across the Dashboard, Leaderboard, Admin Console, and Performance views.
 *
 * @param fullName - The full name string (e.g., "Jonathan Carbungco")
 * @returns Formatted display name (e.g., "Dr. Carbungco"), or "Unknown" if no name provided.
 */
export function formatDisplayName(fullName?: string | null): string {
  if (!fullName || fullName.trim().length === 0) return 'Unknown';
  const parts = fullName.trim().split(/\s+/);
  const lastName = parts[parts.length - 1];
  return `Dr. ${lastName}`;
}

/**
 * Wraps a promise with a timeout. If the promise does not resolve within
 * the specified milliseconds, it rejects with a timeout error.
 * Used to prevent infinite spinners when Supabase or network requests hang.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number = 30000): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Request timed out. Please check your connection.')), ms)
  );
  return Promise.race([promise, timeout]);
}
