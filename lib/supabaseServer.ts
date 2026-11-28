import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { SUPER_ADMIN_EMAILS } from './roles';
import { Profile } from './types';

let adminClientInstance: SupabaseClient | null = null;
let anonServerClientInstance: SupabaseClient | null = null;

/**
 * Returns a Supabase client with the Service Role Key for privileged server-side actions.
 * Throws a descriptive error if environment variables are not configured.
 */
export function getAdminSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Server configuration error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.'
    );
  }

  if (!adminClientInstance) {
    adminClientInstance = createClient(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
      },
    });
  }

  return adminClientInstance;
}

/**
 * Returns an unprivileged Supabase client for validating JWT tokens on the server.
 */
export function getAnonServerSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Server configuration error: Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in environment.'
    );
  }

  if (!anonServerClientInstance) {
    anonServerClientInstance = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return anonServerClientInstance;
}

/**
 * Extracts and verifies the caller's JWT bearer token from the incoming Request.
 */
export async function getAuthenticatedUser(request: Request): Promise<{
  user: User | null;
  token: string | null;
  errorResponse?: NextResponse;
}> {
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return {
      user: null,
      token: null,
      errorResponse: NextResponse.json(
        { error: 'Unauthorized: missing authorization token' },
        { status: 401 }
      ),
    };
  }

  try {
    const anon = getAnonServerSupabase();
    const { data: { user }, error } = await anon.auth.getUser(token);

    if (error || !user) {
      return {
        user: null,
        token: null,
        errorResponse: NextResponse.json(
          { error: 'Unauthorized: invalid or expired session token' },
          { status: 401 }
        ),
      };
    }

    return { user, token };
  } catch (err: unknown) {
    console.error('[supabaseServer] Error validating session token:', err);
    return {
      user: null,
      token: null,
      errorResponse: NextResponse.json(
        { error: 'Unauthorized: authentication check failed' },
        { status: 401 }
      ),
    };
  }
}

/**
 * Resolves a caller's authoritative role using SUPER_ADMIN_EMAILS first,
 * then `authorized_roster` (case-insensitive), falling back to `profiles`
 * only when no roster row exists for the user's email.
 */
async function resolveAuthoritativeRole(
  adminSupabase: SupabaseClient,
  user: User
): Promise<{
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isPrivileged: boolean;
  profile: Profile | null;
}> {
  const email = (user.email || '').toLowerCase().trim();
  const isSuperAdmin = Boolean(
    email && SUPER_ADMIN_EMAILS.some((e) => e.toLowerCase() === email)
  );

  const [rosterRes, profileRes] = await Promise.all([
    email
      ? adminSupabase
          .from('authorized_roster')
          .select('role, pgy, track')
          .ilike('email', email)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    adminSupabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle(),
  ]);

  const profile = (profileRes.data as Profile | null) ?? null;
  const roster = rosterRes.data as { role?: string | null; pgy?: string | null; track?: string | null } | null;

  if (isSuperAdmin) {
    return { isSuperAdmin: true, isAdmin: true, isPrivileged: true, profile };
  }

  if (roster) {
    const rosterRole = (roster.role || '').toLowerCase().trim();
    const rosterPgy = (roster.pgy || '').toLowerCase().trim();
    const rosterTrack = (roster.track || '').toLowerCase().trim();
    const isAdmin = rosterRole === 'admin';
    const isPrivileged =
      isAdmin ||
      rosterRole === 'faculty' ||
      rosterRole === 'gme_staff' ||
      rosterPgy === 'faculty' ||
      rosterTrack === 'faculty';
    return { isSuperAdmin: false, isAdmin, isPrivileged, profile };
  }

  // Fallback for accounts without a roster entry (e.g. legacy service/faculty profiles)
  const profRole = (profile?.role || '').toLowerCase().trim();
  const profPgy = (profile?.pgy || '').toLowerCase().trim();
  const isAdmin = profRole === 'admin';
  const isPrivileged =
    isAdmin || profRole === 'faculty' || profRole === 'gme_staff' || profPgy === 'faculty';
  return { isSuperAdmin: false, isAdmin, isPrivileged, profile };
}

/**
 * Verifies that the caller has admin or faculty privileges, taking into account:
 * 1. Hardcoded SUPER_ADMIN_EMAILS
 * 2. authorized_roster role in ('admin', 'faculty', 'gme_staff'), pgy === 'Faculty', or track === 'faculty'
 * 3. profile fallback only if no authorized_roster row exists
 */
export async function requireAdminOrFaculty(request: Request): Promise<{
  authorized: boolean;
  user?: User;
  profile?: Profile | null;
  isSuperAdmin?: boolean;
  isAdmin?: boolean;
  adminSupabase?: SupabaseClient;
  errorResponse?: NextResponse;
}> {
  const { user, errorResponse } = await getAuthenticatedUser(request);
  if (!user || errorResponse) {
    return { authorized: false, errorResponse };
  }

  const adminSupabase = getAdminSupabase();
  const resolved = await resolveAuthoritativeRole(adminSupabase, user);

  if (!resolved.isPrivileged) {
    return {
      authorized: false,
      user,
      profile: resolved.profile,
      isSuperAdmin: false,
      isAdmin: false,
      errorResponse: NextResponse.json(
        { error: 'Forbidden: administrative or faculty role required' },
        { status: 403 }
      ),
    };
  }

  return {
    authorized: true,
    user,
    profile: resolved.profile,
    isSuperAdmin: resolved.isSuperAdmin,
    isAdmin: resolved.isAdmin,
    adminSupabase,
  };
}

/**
 * Verifies that the caller has strict program administrator privileges:
 * SUPER_ADMIN_EMAILS or authorized_roster.role === 'admin' (profile fallback if no roster row).
 */
export async function requireAdminOnly(request: Request): Promise<{
  authorized: boolean;
  user?: User;
  profile?: Profile | null;
  isSuperAdmin?: boolean;
  adminSupabase?: SupabaseClient;
  errorResponse?: NextResponse;
}> {
  const { user, errorResponse } = await getAuthenticatedUser(request);
  if (!user || errorResponse) {
    return { authorized: false, errorResponse };
  }

  const adminSupabase = getAdminSupabase();
  const resolved = await resolveAuthoritativeRole(adminSupabase, user);

  if (!resolved.isAdmin) {
    return {
      authorized: false,
      user,
      profile: resolved.profile,
      isSuperAdmin: false,
      errorResponse: NextResponse.json(
        { error: 'Forbidden: program administrator role required' },
        { status: 403 }
      ),
    };
  }

  return {
    authorized: true,
    user,
    profile: resolved.profile,
    isSuperAdmin: resolved.isSuperAdmin,
    adminSupabase,
  };
}

/**
 * Verifies Vercel/pg_cron authorization header against process.env.CRON_SECRET
 * using constant-time comparison. Rejects whenever CRON_SECRET is unset/empty.
 */
export function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
  if (!authHeader) return false;

  const expected = `Bearer ${secret}`;
  const a = Buffer.from(authHeader, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export interface PushDispatchError {
  sub_id: string;
  user_id: string | null;
  host: string;
  status?: number;
  error: string;
  action: 'deleted' | 'delete_0_rows' | 'delete_failed' | 'kept';
  deleteError?: string;
}

/**
 * Classifies a Web Push dispatch failure, deletes only permanently unregistered
 * endpoints (HTTP 404/410) by primary key, and records structured diagnostics.
 */
export async function recordPushDispatchFailure(
  supabase: SupabaseClient,
  routeTag: string,
  sub: { id: string; user_id?: string | null; endpoint: string },
  err: unknown,
  pushErrors?: PushDispatchError[]
): Promise<'expired' | 'failed'> {
  const status = (err as { statusCode?: number }).statusCode;
  const errMsg =
    (err as { body?: string }).body ||
    (err instanceof Error ? err.message : String(err));

  let host = 'unknown';
  try {
    host = new URL(sub.endpoint).host;
  } catch {}

  if (status === 404 || status === 410) {
    const { error: delError, count: delCount } = await supabase
      .from('web_push_subscriptions')
      .delete({ count: 'exact' })
      .eq('id', sub.id);

    const action = delError ? 'delete_failed' : delCount ? 'deleted' : 'delete_0_rows';
    if (delError || !delCount) {
      console.error(
        `[${routeTag}] Failed to delete expired subscription ${sub.id} (${host}, HTTP ${status}):`,
        delError ? delError.message : '0 rows deleted'
      );
    } else {
      console.log(
        `[${routeTag}] Deleted expired subscription ${sub.id} (${host}, HTTP ${status}).`
      );
    }

    pushErrors?.push({
      sub_id: sub.id,
      user_id: sub.user_id ?? null,
      host,
      status,
      error: errMsg.slice(0, 140),
      action,
      ...(delError ? { deleteError: delError.message } : {}),
    });
    return 'expired';
  }

  console.error(`[${routeTag}] Push failed for ${sub.id} (${host}):`, status, errMsg);
  pushErrors?.push({
    sub_id: sub.id,
    user_id: sub.user_id ?? null,
    host,
    status,
    error: errMsg.slice(0, 140),
    action: 'kept',
  });
  return 'failed';
}
