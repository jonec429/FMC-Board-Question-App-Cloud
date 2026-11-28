import { NextResponse } from 'next/server';
import { requireAdminOnly } from '@/lib/supabaseServer';
import { SUPER_ADMIN_EMAILS } from '@/lib/roles';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const authResult = await requireAdminOnly(request);
    if (!authResult.authorized || !authResult.adminSupabase || !authResult.user) {
      return authResult.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminSupabase = authResult.adminSupabase;
    const isCallerSuperAdmin = Boolean(authResult.isSuperAdmin);

    const body = await request.json();
    const { action, email, userId, password } = body;

    if (!action || (!email && !userId)) {
      return NextResponse.json({ error: 'Missing required parameters: action and email or userId are required' }, { status: 400 });
    }

    // Determine target user in auth.users
    let targetUser: any = null;

    if (userId) {
      const { data: userById, error: userByIdErr } = await adminSupabase.auth.admin.getUserById(userId);
      if (!userByIdErr && userById?.user) {
        targetUser = userById.user;
      }
    }

    if (!targetUser && email) {
      const cleanEmail = String(email).toLowerCase().trim();
      // Fast O(1) lookup via profiles table first (avoids listUsers 50-user cap)
      const { data: profMatch } = await adminSupabase
        .from('profiles')
        .select('id')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (profMatch?.id) {
        const { data: userById, error: userByIdErr } = await adminSupabase.auth.admin.getUserById(profMatch.id);
        if (!userByIdErr && userById?.user) {
          targetUser = userById.user;
        }
      }

      // Fallback: paginate auth.admin.listUsers if profile row was never created
      if (!targetUser) {
        let page = 1;
        const perPage = 1000;
        while (true) {
          const { data: userList, error: listErr } = await adminSupabase.auth.admin.listUsers({ page, perPage });
          if (listErr || !userList?.users || userList.users.length === 0) break;
          const found = userList.users.find((u: any) => u.email?.toLowerCase().trim() === cleanEmail);
          if (found) {
            targetUser = found;
            break;
          }
          if (userList.users.length < perPage) break;
          page++;
        }
      }
    }

    // If still not found, check authorized_roster to give helpful diagnostic feedback
    if (!targetUser) {
      const cleanEmail = String(email || '').toLowerCase().trim();
      const safeLike = cleanEmail.replace(/[,().%*_\\]/g, '');
      const safeLocal = safeLike.replace(/@.*$/, '');
      const { data: rosterEntry } = safeLike
        ? await adminSupabase
            .from('authorized_roster')
            .select('name, email, role, status')
            .or(`email.ilike.%${safeLike}%,email.ilike.%${safeLocal}%`)
            .limit(5)
        : { data: [] };

      if (rosterEntry && rosterEntry.length > 0) {
        const exactMatch = rosterEntry.find(r => r.email.toLowerCase() === cleanEmail);
        if (exactMatch) {
          return NextResponse.json({
            error: `${cleanEmail} is on the authorized roster, but has never created an account (Pending Registration). Send them an invite to register instead.`
          }, { status: 404 });
        } else {
          const suggestions = rosterEntry.map(r => r.email).join(', ');
          return NextResponse.json({
            error: `No account found for "${cleanEmail}". Did you mean one of these roster members: ${suggestions}?`
          }, { status: 404 });
        }
      }

      return NextResponse.json({
        error: `No registered account found matching "${email || userId}".`
      }, { status: 404 });
    }

    // Prevent non-super-admins from modifying super-admin credentials
    const targetEmail = (targetUser.email || '').toLowerCase().trim();
    const isTargetSuperAdmin = SUPER_ADMIN_EMAILS.some((e) => e.toLowerCase() === targetEmail);
    if (isTargetSuperAdmin && !isCallerSuperAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: only a super administrator can modify super-admin credentials.' },
        { status: 403 }
      );
    }

    // Determine trusted base URL for recovery links (ignore spoofable Origin/Referer in production)
    const configuredAppUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://brq.stvfamilymed.org').replace(/\/+$/, '');
    const reqOriginHeader = request.headers.get('origin') || '';
    const reqOrigin =
      process.env.NODE_ENV !== 'production' && reqOriginHeader.startsWith('http://localhost:')
        ? reqOriginHeader
        : configuredAppUrl;

    // 1. ACTION: set_password
    if (action === 'set_password') {
      if (!password || typeof password !== 'string' || password.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters long' }, { status: 400 });
      }

      const { data: updated, error: updateErr } = await adminSupabase.auth.admin.updateUserById(targetUser.id, {
        password: password,
        email_confirm: true, // Auto-confirm email if it wasn't confirmed
        user_metadata: {
          ...(targetUser.user_metadata || {}),
          must_reset_password: true,
        }
      });

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        action: 'set_password',
        email: targetUser.email,
        message: `Password successfully updated for ${targetUser.email}.`
      });
    }

    // 2. ACTION: generate_link
    if (action === 'generate_link') {
      const { data: linkData, error: linkErr } = await adminSupabase.auth.admin.generateLink({
        type: 'recovery',
        email: targetUser.email,
        options: {
          redirectTo: `${reqOrigin}/auth/callback`
        }
      });

      if (linkErr) {
        return NextResponse.json({ error: linkErr.message }, { status: 500 });
      }

      const hashedToken = linkData?.properties?.hashed_token;
      // Build a foolproof direct recovery URL that uses verifyOtp on the client
      const directRecoveryUrl = `${reqOrigin}/auth/callback?token_hash=${hashedToken}&type=recovery`;

      return NextResponse.json({
        success: true,
        action: 'generate_link',
        email: targetUser.email,
        directLink: directRecoveryUrl,
        actionLink: linkData?.properties?.action_link,
        emailOtp: linkData?.properties?.email_otp,
      });
    }

    // 3. ACTION: send_reset_email
    if (action === 'send_reset_email') {
      const { error: resetErr } = await adminSupabase.auth.resetPasswordForEmail(targetUser.email, {
        redirectTo: `${reqOrigin}/auth/callback`
      });

      if (resetErr) {
        return NextResponse.json({ error: resetErr.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        action: 'send_reset_email',
        email: targetUser.email,
        message: `Password reset email dispatched to ${targetUser.email}.`
      });
    }

    return NextResponse.json({ error: `Unknown action: "${action}"` }, { status: 400 });

  } catch (error: any) {
    console.error('Admin user-password error:', error);
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
