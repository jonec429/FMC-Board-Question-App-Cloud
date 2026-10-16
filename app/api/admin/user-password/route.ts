import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SUPER_ADMIN_EMAILS } from '@/lib/roles';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.split('Bearer ')[1];

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized: missing authorization token' }, { status: 401 });
    }

    const anonSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: { user: callerUser }, error: callerError } = await anonSupabase.auth.getUser(token);
    if (callerError || !callerUser) {
      return NextResponse.json({ error: 'Unauthorized: invalid session' }, { status: 401 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Server configuration error: missing service role key' }, { status: 500 });
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    // Verify admin role
    const callerEmail = (callerUser.email || '').toLowerCase();
    const isSuperAdmin = SUPER_ADMIN_EMAILS.map(e => e.toLowerCase()).includes(callerEmail);

    let isAdminUser = isSuperAdmin;
    if (!isAdminUser) {
      const { data: callerProfile } = await adminSupabase
        .from('profiles')
        .select('role')
        .eq('id', callerUser.id)
        .single();

      if (callerProfile?.role === 'admin') {
        isAdminUser = true;
      }
    }

    if (!isAdminUser) {
      return NextResponse.json({ error: 'Forbidden: only program administrators can manage credentials' }, { status: 403 });
    }

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
      const cleanEmail = email.toLowerCase().trim();
      const { data: userList, error: listErr } = await adminSupabase.auth.admin.listUsers();
      if (!listErr && userList?.users) {
        targetUser = userList.users.find((u: any) => u.email?.toLowerCase().trim() === cleanEmail);
      }
    }

    // If still not found, check authorized_roster to give helpful diagnostic feedback
    if (!targetUser) {
      const cleanEmail = (email || '').toLowerCase().trim();
      const { data: rosterEntry } = await adminSupabase
        .from('authorized_roster')
        .select('name, email, role, status')
        .or(`email.ilike.%${cleanEmail}%,email.ilike.%${cleanEmail.replace(/@.*$/, '')}%`)
        .limit(5);

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

    // Determine base URL for links
    const reqOrigin = request.headers.get('origin') || 
                      (request.headers.get('referer') ? new URL(request.headers.get('referer')!).origin : null) || 
                      process.env.NEXT_PUBLIC_APP_URL || 
                      'https://brq.stvfamilymed.org';

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
