import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { SUPER_ADMIN_EMAILS, UserRole } from './roles';
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
 * Verifies that the caller has admin or faculty privileges, taking into account:
 * 1. Hardcoded SUPER_ADMIN_EMAILS
 * 2. profile.role in ('admin', 'faculty', 'gme_staff')
 * 3. authorized_roster pgy === 'Faculty'
 */
export async function requireAdminOrFaculty(request: Request): Promise<{
  authorized: boolean;
  user?: User;
  profile?: Profile | null;
  adminSupabase?: SupabaseClient;
  errorResponse?: NextResponse;
}> {
  const { user, errorResponse } = await getAuthenticatedUser(request);
  if (!user || errorResponse) {
    return { authorized: false, errorResponse };
  }

  const adminSupabase = getAdminSupabase();
  const email = (user.email || '').toLowerCase().trim();
  const isSuperAdmin = SUPER_ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(email);

  if (isSuperAdmin) {
    return { authorized: true, user, adminSupabase };
  }

  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  const role = (profile?.role || '').toLowerCase();
  const isPrivileged = role === 'admin' || role === 'faculty' || role === 'gme_staff';

  if (!isPrivileged) {
    return {
      authorized: false,
      user,
      profile,
      errorResponse: NextResponse.json(
        { error: 'Forbidden: administrative or faculty role required' },
        { status: 403 }
      ),
    };
  }

  return { authorized: true, user, profile, adminSupabase };
}

/**
 * Verifies Vercel Cron authorization header against process.env.CRON_SECRET.
 */
export function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
  return authHeader === `Bearer ${secret}`;
}
