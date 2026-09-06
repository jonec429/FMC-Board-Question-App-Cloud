import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';
import { getCurrentAcademicYear } from '@/lib/academicYear';
import {
  getDueBlocks,
  getOverdueBlocks,
  getRiskLevel,
  getComplianceRisk,
  getRiskReasons,
  computeTrend,
  RiskLevel
} from '@/lib/residentRisk';
import { SUPER_ADMIN_EMAILS } from '@/lib/roles';
import { Block, BlockSchedule, Result, RosterEntry, Profile } from '@/lib/types';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ResidentRiskSummary {
  resident: RosterEntry;
  name: string;
  surname: string;
  advisor: string;
  curriculumAvg: number;
  curriculumAttempts: number;
  blocksCompleted: number;
  onTimePct: number;
  overdueCount: number;
  academicRisk: RiskLevel;
  complianceRisk: RiskLevel;
  isAtRisk: boolean;
  isAttention: boolean;
  reasons: string[];
  trendDelta?: number | null;
}

export async function GET(request: Request) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
  const privateKey = process.env.VAPID_PRIVATE_KEY || '';

  if (!publicKey || !privateKey) {
    console.error('[faculty-digest] VAPID keys not configured.');
    return NextResponse.json({ success: false, error: 'VAPID keys not configured' }, { status: 500 });
  }

  webpush.setVapidDetails(
    'mailto:jonathan.carbungco@ascension.org',
    publicKey,
    privateKey
  );

  const url = new URL(request.url);
  const isForce = url.searchParams.get('force') === 'true';
  const isDryRun = url.searchParams.get('dryRun') === 'true';

  // Authenticate request: accept CRON_SECRET or an authenticated Admin user token
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  let isAuthorized = false;
  let callerEmail = 'cron-system';

  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    if (token === process.env.CRON_SECRET) {
      isAuthorized = true;
    } else {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (!authError && user?.email) {
          callerEmail = user.email;
          const isSuperAdmin = SUPER_ADMIN_EMAILS.map(e => e.toLowerCase()).includes(user.email.toLowerCase());
          const { data: callerProfile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .maybeSingle();

          if (isSuperAdmin || callerProfile?.role === 'admin') {
            isAuthorized = true;
          }
        }
      } catch (err) {
        console.warn('[faculty-digest] Error verifying bearer token:', err);
      }
    }
  }

  if (!isAuthorized) {
    console.warn('[faculty-digest] Unauthorized request — CRON_SECRET or Admin token required.');
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // Bi-weekly cadence logic: base date June 29, 2026 (Monday).
    // Can be bypassed with ?force=true for testing or manual triggers.
    if (!isForce) {
      const startDate = new Date('2026-06-29T00:00:00Z');
      const now = new Date();
      const diffTime = now.getTime() - startDate.getTime();
      const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));

      if (diffWeeks % 2 !== 0) {
        console.log(`[faculty-digest] Off-week (Week ${diffWeeks} since start). Skipping push notifications.`);
        return NextResponse.json({ success: true, message: 'Skipped (off-week)' });
      }
    }

    const academicYear = getCurrentAcademicYear();

    // Fetch required datasets concurrently
    const [rosterRes, profilesRes, blocksRes, scheduleRes, resultsRes, subsRes] = await Promise.all([
      supabase.from('authorized_roster').select('*'),
      supabase.from('profiles').select('*'),
      supabase.from('blocks').select('*'),
      supabase.from('block_schedule').select('*'),
      supabase.from('results').select('*'),
      supabase.from('web_push_subscriptions').select('*')
    ]);

    if (rosterRes.error) throw rosterRes.error;
    if (profilesRes.error) throw profilesRes.error;
    if (blocksRes.error) throw blocksRes.error;
    if (scheduleRes.error) throw scheduleRes.error;
    if (resultsRes.error) throw resultsRes.error;
    if (subsRes.error) throw subsRes.error;

    const roster = (rosterRes.data || []) as RosterEntry[];
    const profiles = (profilesRes.data || []) as Profile[];
    const blocks = (blocksRes.data || []) as Block[];
    const blockSchedule = (scheduleRes.data || []) as BlockSchedule[];
    const results = (resultsRes.data || []) as Result[];
    const allSubs = subsRes.data || [];

    // Filter due curriculum blocks for the current academic year
    const dueBlocks = getDueBlocks(blocks, blockSchedule, academicYear);

    // Map resident email to profile ID
    const emailToUserId = new Map<string, string>();
    profiles.forEach(p => {
      if (p.email && p.id) emailToUserId.set(p.email.toLowerCase(), p.id);
    });

    // Active non-graduated FM residents
    const activeResidents = roster.filter(r =>
      r.status !== 'graduated' &&
      r.status !== 'on_leave' &&
      (r.role === 'resident' || r.role === 'chief' || !r.role) &&
      r.track !== 'faculty' &&
      r.pgy !== 'Faculty'
    );

    // Compute risk profile for every active resident
    const residentRiskMap: ResidentRiskSummary[] = activeResidents.map(resident => {
      const resEmail = resident.email?.toLowerCase();
      const resUserId = resEmail ? emailToUserId.get(resEmail) : undefined;

      const resResults = results.filter((r: Result & { email?: string | null }) =>
        (resEmail && r.legacy_email?.toLowerCase() === resEmail) ||
        (resEmail && r.email?.toLowerCase() === resEmail) ||
        (resUserId && r.user_id === resUserId)
      );

      const blockResults = resResults.filter(
        r => !r.topic?.includes('[Attendance]') && !r.topic?.includes('[Manual]')
      );

      const assignedResults = blockResults.filter(
        r => (r.academic_points || 0) > 0 || r.timing_status != null
      );

      const topicBestPts = new Map<string, number>();
      assignedResults.forEach(r => {
        const cur = topicBestPts.get(r.topic) || 0;
        if ((r.academic_points || 0) > cur || !topicBestPts.has(r.topic)) {
          topicBestPts.set(r.topic, r.academic_points || 0);
        }
      });

      const completedTitles = new Set(topicBestPts.keys());
      const overdueBlocks = getOverdueBlocks(dueBlocks, completedTitles);
      const overdueCount = overdueBlocks.length;

      const nonBonusBlocks = Array.from(topicBestPts.entries()).filter(
        ([topic]) => !topic?.toLowerCase().includes('bonus')
      );
      const onTimeBlocks = nonBonusBlocks.filter(([, pts]) => pts >= 2);
      const onTimePct = nonBonusBlocks.length > 0 ? (onTimeBlocks.length / nonBonusBlocks.length) * 100 : 100;

      const curriculumAvg = assignedResults.length > 0
        ? assignedResults.reduce((a, r) => a + (r.percentage || 0), 0) / assignedResults.length
        : 0;

      const academicRisk = getRiskLevel(curriculumAvg, assignedResults.length);
      const complianceRisk = getComplianceRisk(onTimePct, topicBestPts.size, overdueCount);

      const chronological = assignedResults
        .filter(r => r.percentage != null && r.created_at)
        .sort((a, b) => new Date(a.created_at!).getTime() - new Date(b.created_at!).getTime())
        .map(r => r.percentage as number);

      const trend = computeTrend(chronological);

      const isAtRisk = academicRisk === 'red' || complianceRisk === 'red';
      const isAttention = !isAtRisk && (academicRisk === 'yellow' || complianceRisk === 'yellow' || trend.declining);

      const reasons = getRiskReasons({
        curriculumAvg,
        curriculumAttempts: assignedResults.length,
        onTimePct,
        blocksCompleted: topicBestPts.size,
        overdueCount,
        trendDelta: trend.delta
      });

      // Format clean surname
      const surname = resident.last_name || resident.name?.trim().split(' ').slice(-1)[0] || 'Resident';

      return {
        resident,
        name: resident.name || resident.email,
        surname,
        advisor: (resident.advisor || '').trim(),
        curriculumAvg,
        curriculumAttempts: assignedResults.length,
        blocksCompleted: topicBestPts.size,
        onTimePct,
        overdueCount,
        academicRisk,
        complianceRisk,
        isAtRisk,
        isAttention,
        reasons,
        trendDelta: trend.delta
      };
    });

    const programAtRisk = residentRiskMap.filter(r => r.isAtRisk);
    const programAttention = residentRiskMap.filter(r => r.isAttention);
    const programFlagged = [...programAtRisk, ...programAttention];

    // Find all faculty, gme_staff, and admin profiles
    const facultyProfiles = profiles.filter(p => {
      const isSuper = SUPER_ADMIN_EMAILS.map(e => e.toLowerCase()).includes((p.email || '').toLowerCase());
      return isSuper || p.role === 'admin' || p.role === 'faculty' || p.role === 'gme_staff' || p.pgy === 'Faculty';
    });

    // Respect user notification preferences
    const optedInFaculty = facultyProfiles.filter(p => p.notification_preferences?.faculty_digest !== false);

    if (optedInFaculty.length === 0) {
      console.log('[faculty-digest] No faculty found with digest enabled.');
      return NextResponse.json({ success: true, message: 'No faculty found with digest enabled', counts: { total: 0 } });
    }

    const run_id = crypto.randomUUID();
    let sent = 0;
    let failed = 0;
    let expired = 0;
    let skipped = 0;

    const notificationsToSend: Array<{
      userId: string;
      email: string;
      title: string;
      body: string;
      url: string;
      subscription: any;
    }> = [];

    // Map each faculty recipient to their tailored push payload
    for (const faculty of optedInFaculty) {
      const facultySubs = allSubs.filter(s => s.user_id === faculty.id);
      if (facultySubs.length === 0) continue;

      const facultyEmail = (faculty.email || '').toLowerCase();
      const isSuper = SUPER_ADMIN_EMAILS.map(e => e.toLowerCase()).includes(facultyEmail);
      const isAdminRole = isSuper || faculty.role === 'admin';

      // Identify faculty name representations
      const facultyRosterRow = roster.find(r => r.email?.toLowerCase() === facultyEmail);
      const possibleNames = new Set([
        faculty.full_name?.trim().toLowerCase(),
        `${faculty.first_name || ''} ${faculty.last_name || ''}`.trim().toLowerCase(),
        facultyRosterRow?.name?.trim().toLowerCase()
      ].filter(Boolean) as string[]);

      // Find advisees for this faculty member
      const myAdvisees = residentRiskMap.filter(r => {
        if (!r.advisor) return false;
        const advLower = r.advisor.toLowerCase();
        for (const name of Array.from(possibleNames)) {
          if (advLower.includes(name) || name.includes(advLower)) return true;
        }
        return false;
      });

      let title = '';
      let body = '';
      const targetUrl = '/?admin=performance';

      if (myAdvisees.length > 0) {
        // Recipient is a faculty advisor
        const flaggedAdvisees = myAdvisees.filter(a => a.isAtRisk || a.isAttention);

        if (flaggedAdvisees.length > 0) {
          title = `⚠️ Advisee Alert: ${flaggedAdvisees.length} Need${flaggedAdvisees.length === 1 ? 's' : ''} Attention`;

          // Format specific resident alerts
          const residentSnippets = flaggedAdvisees.slice(0, 2).map(a => {
            const reason = a.reasons[0] || (a.isAtRisk ? 'At Risk' : 'Needs Attention');
            return `Dr. ${a.surname} (${reason})`;
          });

          if (flaggedAdvisees.length > 2) {
            residentSnippets.push(`+${flaggedAdvisees.length - 2} more`);
          }

          body = `${residentSnippets.join(', ')}. Tap to review advisees.`;
        } else {
          // All advisees on track
          if (isAdminRole && programFlagged.length > 0) {
            title = `✅ Advisees On Track (${programFlagged.length} in program)`;
            body = `All ${myAdvisees.length} of your advisees are on track. ${programFlagged.length} residents need program review. Tap to view.`;
          } else {
            title = `✅ Advisee Digest: All On Track`;
            body = `All ${myAdvisees.length} of your assigned advisees are on track with curriculum blocks. Tap to view.`;
          }
        }
      } else if (isAdminRole) {
        // Leadership / Super Admin with no direct advisees
        if (programFlagged.length > 0) {
          title = `🚨 Program Risk: ${programFlagged.length} Flagged`;
          body = `${programAtRisk.length} at risk, ${programAttention.length} need attention across active residents. Tap to review.`;
        } else {
          title = `✅ Program Digest: All On Track`;
          body = `All ${activeResidents.length} active residents are meeting curriculum benchmarks. Tap to view.`;
        }
      } else {
        // Faculty member with no assigned advisees
        title = `📋 FMC Faculty Digest`;
        body = `Resident review is ready. Tap to view the curriculum performance overview.`;
      }

      for (const sub of facultySubs) {
        notificationsToSend.push({
          userId: faculty.id,
          email: faculty.email || '',
          title,
          body,
          url: targetUrl,
          subscription: sub
        });
      }
    }

    console.log(`[faculty-digest] Prepared ${notificationsToSend.length} push notifications across ${optedInFaculty.length} eligible faculty. (Run ID: ${run_id})`);

    // In dry-run mode, return the prepared payloads without hitting webpush
    if (isDryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        run_id,
        summary: {
          activeResidents: activeResidents.length,
          programAtRisk: programAtRisk.length,
          programAttention: programAttention.length,
          programFlagged: programFlagged.length,
          eligibleFaculty: optedInFaculty.length,
          notificationsPrepared: notificationsToSend.length
        },
        notifications: notificationsToSend.map(n => ({
          userId: n.userId,
          email: n.email,
          title: n.title,
          body: n.body,
          url: n.url
        }))
      });
    }

    // Dispatch Web Push notifications in batches
    const BATCH_SIZE = 10;
    const BATCH_DELAY_MS = 200;

    for (let i = 0; i < notificationsToSend.length; i += BATCH_SIZE) {
      const batch = notificationsToSend.slice(i, i + BATCH_SIZE);

      const batchPromises = batch.map(async (item) => {
        const sub = item.subscription;
        if (!sub.p256dh || !sub.auth || !sub.endpoint) {
          skipped++;
          return;
        }

        const pushPayload = JSON.stringify({
          title: item.title,
          body: item.body,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/badge-96x96.png',
          data: {
            run_id,
            url: item.url
          }
        });

        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            auth: sub.auth,
            p256dh: sub.p256dh
          }
        };

        try {
          await webpush.sendNotification(pushSubscription, pushPayload);
          sent++;
        } catch (err: unknown) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 401 || status === 403 || status === 404 || status === 410) {
            console.log(`[faculty-digest] Subscription expired (${status}), deleting: ${sub.endpoint.slice(0, 50)}...`);
            await supabase.from('web_push_subscriptions').delete().eq('endpoint', sub.endpoint);
            expired++;
          } else {
            console.error(`[faculty-digest] Push failed for ${sub.endpoint.slice(0, 50)}...:`, status, err);
            failed++;
          }
        }
      });

      await Promise.allSettled(batchPromises);

      if (i + BATCH_SIZE < notificationsToSend.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    const summary = {
      total: notificationsToSend.length,
      sent,
      failed,
      expired,
      skipped,
      programAtRisk: programAtRisk.length,
      programAttention: programAttention.length
    };

    console.log('[faculty-digest] Complete:', JSON.stringify(summary));

    // Log to Supabase
    await supabase.from('cron_logs').insert({
      cron_name: 'faculty-digest',
      status: 'success',
      details: { ...summary, run_id, caller: callerEmail }
    });

    return NextResponse.json({
      success: true,
      message: 'Faculty digest notifications processed.',
      counts: summary
    });

  } catch (err: unknown) {
    console.error('[faculty-digest] Fatal error:', err);
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : String(err)
    }, { status: 500 });
  }
}



