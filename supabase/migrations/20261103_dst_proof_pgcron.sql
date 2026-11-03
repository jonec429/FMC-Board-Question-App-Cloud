-- ============================================================================
-- 20261103_dst_proof_pgcron.sql
--
-- PERMANENT DST-PROOF PG_CRON SCHEDULES FOR SUPABASE (AMERICA/NEW_YORK)
--
-- PROBLEM:
--   Supabase pg_cron runs strictly in UTC. Previously, UTC offsets were hardcoded
--   for Daylight Saving Time (EDT = UTC-4):
--     * 8:30 AM EDT  -> 12:30 UTC
--     * 12:00 PM EDT -> 16:00 UTC
--     * 12:35 PM EDT -> 16:35 UTC
--   When Daylight Saving Time ended on Nov 1, 2026 (switching to EST = UTC-5),
--   these fixed UTC jobs fired 1 HOUR EARLY:
--     * Morning push fired at 7:30 AM EST
--     * Reminder push fired at 11:00 AM EST
--     * Noon release push fired at 11:35 AM EST (before the 12:30 PM answer unlock!)
--   Residents received notifications claiming the answer was available, but
--   the app's unlock was still locked for another 55 minutes.
--
-- SOLUTION (ZERO-MAINTENANCE, YEAR-ROUND ACCURACY):
--   Each job is scheduled across BOTH candidate UTC hours (e.g. '30 12,13 * * 1-5').
--   Inside the query, PostgreSQL evaluates:
--     WHERE to_char(now() AT TIME ZONE 'America/New_York', 'HH24:MI') = '<TARGET>'
--
--   Because PostgreSQL maintains the official IANA tzdata database:
--     * During Summer (EDT): UTC 12:30 is 08:30 in NY -> WHERE is TRUE  -> executes at 8:30 AM EDT.
--                            UTC 13:30 is 09:30 in NY -> WHERE is FALSE -> returns 0 rows (no HTTP call).
--     * During Winter (EST): UTC 12:30 is 07:30 in NY -> WHERE is FALSE -> returns 0 rows (no HTTP call).
--                            UTC 13:30 is 08:30 in NY -> WHERE is TRUE  -> executes at 8:30 AM EST.
--
--   This completely eliminates the need for manual semi-annual migrations forever.
--
-- INSTRUCTIONS:
--   1. Replace __PASTE_YOUR_CRON_SECRET_HERE__ with your Vercel CRON_SECRET.
--   2. Run this in the Supabase SQL Editor.
-- ============================================================================

-- 1. Unschedule all previous versions of these cron jobs
do $$ begin perform cron.unschedule('qotd-morning-push'); exception when others then null; end $$;
do $$ begin perform cron.unschedule('qotd-reminder-push'); exception when others then null; end $$;
do $$ begin perform cron.unschedule('qotd-noon-push'); exception when others then null; end $$;
do $$ begin perform cron.unschedule('faculty-digest-push'); exception when others then null; end $$;
do $$ begin perform cron.unschedule('block-reminders-push'); exception when others then null; end $$;
do $$ begin perform cron.unschedule('take_leaderboard_snapshot_job'); exception when others then null; end $$;

-- 2. Morning QOTD push -- 8:30 AM Eastern Time (EDT: 12:30 UTC / EST: 13:30 UTC), Mon-Fri
select cron.schedule(
  'qotd-morning-push',
  '30 12,13 * * 1-5',
  $$
    select net.http_get(
      url     := 'https://brq.stvfamilymed.org/api/cron/qotd-morning',
      headers := jsonb_build_object('Authorization', 'Bearer __PASTE_YOUR_CRON_SECRET_HERE__'),
      timeout_milliseconds := 30000
    )
    where to_char(now() at time zone 'America/New_York', 'HH24:MI') = '08:30';
  $$
);

-- 3. Reminder QOTD push -- 12:00 PM Eastern Time (EDT: 16:00 UTC / EST: 17:00 UTC), Mon-Fri
select cron.schedule(
  'qotd-reminder-push',
  '0 16,17 * * 1-5',
  $$
    select net.http_get(
      url     := 'https://brq.stvfamilymed.org/api/cron/qotd-reminder',
      headers := jsonb_build_object('Authorization', 'Bearer __PASTE_YOUR_CRON_SECRET_HERE__'),
      timeout_milliseconds := 30000
    )
    where to_char(now() at time zone 'America/New_York', 'HH24:MI') = '12:00';
  $$
);

-- 4. Noon QOTD release push -- 12:35 PM Eastern Time (EDT: 16:35 UTC / EST: 17:35 UTC), Mon-Fri
select cron.schedule(
  'qotd-noon-push',
  '35 16,17 * * 1-5',
  $$
    select net.http_get(
      url     := 'https://brq.stvfamilymed.org/api/cron/qotd-noon',
      headers := jsonb_build_object('Authorization', 'Bearer __PASTE_YOUR_CRON_SECRET_HERE__'),
      timeout_milliseconds := 30000
    )
    where to_char(now() at time zone 'America/New_York', 'HH24:MI') = '12:35';
  $$
);

-- 5. Faculty Advisor Digest push -- 9:00 AM Eastern Time (EDT: 13:00 UTC / EST: 14:00 UTC), Mondays
select cron.schedule(
  'faculty-digest-push',
  '0 13,14 * * 1',
  $$
    select net.http_get(
      url     := 'https://brq.stvfamilymed.org/api/cron/faculty-digest',
      headers := jsonb_build_object('Authorization', 'Bearer __PASTE_YOUR_CRON_SECRET_HERE__'),
      timeout_milliseconds := 30000
    )
    where to_char(now() at time zone 'America/New_York', 'HH24:MI') = '09:00';
  $$
);

-- 6. Block Reminders push/email -- 9:00 AM Eastern Time (EDT: 13:00 UTC / EST: 14:00 UTC), Thursdays
select cron.schedule(
  'block-reminders-push',
  '0 13,14 * * 4',
  $$
    select net.http_get(
      url     := 'https://brq.stvfamilymed.org/api/cron/block-reminders',
      headers := jsonb_build_object('Authorization', 'Bearer __PASTE_YOUR_CRON_SECRET_HERE__'),
      timeout_milliseconds := 30000
    )
    where to_char(now() at time zone 'America/New_York', 'HH24:MI') = '09:00';
  $$
);

-- 7. Leaderboard Snapshot -- Midnight Eastern Time on 1st of every month (EDT: 04:00 UTC / EST: 05:00 UTC)
select cron.schedule(
  'take_leaderboard_snapshot_job',
  '0 4,5 1 * *',
  $$
    select public.take_leaderboard_snapshot()
    where to_char(now() at time zone 'America/New_York', 'HH24:MI') = '00:00';
  $$
);

-- VERIFY ACTIVE JOBS
select jobid, jobname, schedule, active, command from cron.job order by jobname;
