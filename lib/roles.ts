/**
 * Centralized role utilities for the FMC QBank Cloud application.
 *
 * 3-Tier Role System:
 *   - resident: Standard user — takes quizzes, sees own performance + leaderboard
 *   - faculty:  Reviews resident performance — limited to their own advisees in admin views
 *   - admin:    Full access to all admin features and program-wide data
 *
 * Role resolution priority (highest first):
 *   1. Hard-coded SUPER_ADMIN_EMAILS  → 'admin'
 *   2. profile.role === 'admin'        → 'admin'
 *   3. profile.role === 'faculty'      → 'faculty'
 *   4. profile.pgy === 'Faculty'       → 'faculty' (legacy roster convention)
 *   5. otherwise                       → 'resident'
 */

export type UserRole = 'resident' | 'faculty' | 'admin';

/**
 * Emails that always resolve to 'admin' regardless of profile data.
 * Acts as a fail-safe lock-out prevention list.
 */
const SUPER_ADMIN_EMAILS: string[] = [
  'jonathan.carbungco@ascension.org',
  'j.carbungco1@gmail.com',
];

/**
 * Resolves the effective role for a user based on their auth account and profile row.
 */
export function getUserRole(user?: any, profile?: any): UserRole {
  if (!user) return 'resident';
  const email = (user?.email || '').toLowerCase();
  if (email && SUPER_ADMIN_EMAILS.map(e => e.toLowerCase()).includes(email)) {
    return 'admin';
  }
  if (profile?.role === 'admin') return 'admin';
  if (profile?.role === 'faculty') return 'faculty';
  if (profile?.pgy === 'Faculty') return 'faculty';
  return 'resident';
}

/** Returns true only for full admins (super-admin emails or profile.role==='admin'). */
export function isAdmin(user?: any, profile?: any): boolean {
  return getUserRole(user, profile) === 'admin';
}

/** Returns true for faculty AND admins (admins inherit all faculty privileges). */
export function isFaculty(user?: any, profile?: any): boolean {
  const role = getUserRole(user, profile);
  return role === 'faculty' || role === 'admin';
}

/** Gate for opening the Admin Console — currently faculty and admins. */
export function canAccessAdmin(user?: any, profile?: any): boolean {
  return isFaculty(user, profile);
}

/**
 * For faculty (not admin), returns the advisor name they should filter resident lists by.
 * Returns null for admins (they see all residents) or residents (no admin access).
 *
 * The advisor name matches the value stored in `authorized_roster.advisor` for residents.
 */
export function getFacultyAdviseeFilter(user?: any, profile?: any): string | null {
  const role = getUserRole(user, profile);
  if (role !== 'faculty') return null; // admins see everyone, residents have no admin
  return profile?.full_name || null;
}

/** Human-friendly label for the resolved role — used in UI badges. */
export function getRoleLabel(user?: any, profile?: any): string {
  const role = getUserRole(user, profile);
  return role.charAt(0).toUpperCase() + role.slice(1);
}
