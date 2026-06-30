-- ============================================================================
-- migrate_qotd_pgcron.sql
-- Punctual QOTD push notifications, scheduled from INSIDE Supabase (pg_cron).
--
-- WHY: the old reminders fired from free GitHub Actions + Vercel crons, which are
-- "best effort" and routinely ran 5-20+ minutes late. Supabase pg_cron runs on the
-- database itself and fires on time. This becomes the SINGLE source of truth for
-- the QOTD pushes (the two old schedulers get retired once this is verified).
--
-- WHAT IT SCHEDULES (Monday-Friday):
--    * 12:30 UTC  ->  8:30 AM Eastern (EDT)  ->  /api/cron/qotd-morning
--    * 15:30 UTC  -> 11:30 AM Eastern (EDT)  ->  /api/cron/qotd-reminder
--    * 16:30 UTC  -> 12:30 PM Eastern (EDT)  ->  /api/cron/qotd-noon
--   NOTE ON DST: these are fixed UTC times (same as the old crons). In winter
--   (EST) they land one hour earlier — 7:30 AM and 11:30 AM. If you want them
--   pinned to wall-clock time year-round, tell me and we'll adjust each November.
--
-- -------------------------------------------------------------------------
-- BEFORE YOU RUN THIS  (two one-time edits + one dashboard step):
--   1. Supabase Dashboard -> Database -> Extensions. Search for and ENABLE:
--          pg_cron      and      pg_net
--   2. Replace  __PASTE_YOUR_CRON_SECRET_HERE__  (it appears 3 times below) with
--      the exact value of CRON_SECRET from your Vercel project settings.
--   3. If your live site is NOT https://brq.stvfamilymed.org, fix the URL too.
--
-- SAFE TO RE-RUN: it deletes the old jobs first, so re-running just refreshes them.
-- ============================================================================

-- 1. Remove any previous versions of these jobs (makes this script re-runnable)
do $$ begin perform cron.unschedule('qotd-morning-push'); exception when others then null; end $$;
do $$ begin perform cron.unschedule('qotd-reminder-push');  exception when others then null; end $$;
do $$ begin perform cron.unschedule('qotd-noon-push');    exception when others then null; end $$;

-- 2. Morning push  -- 12:30 UTC = 8:30 AM Eastern (EDT), Mon-Fri
select cron.schedule(
  'qotd-morning-push',
  '30 12 * * 1-5',
  $$
    select net.http_get(
      url     := 'https://brq.stvfamilymed.org/api/cron/qotd-morning',
      headers := jsonb_build_object('Authorization', 'Bearer __PASTE_YOUR_CRON_SECRET_HERE__'),
      timeout_milliseconds := 30000
    );
  $$
);

-- 3. Reminder push  -- 16:00 UTC = 12:00 PM Eastern (EDT), Mon-Fri
select cron.schedule(
  'qotd-reminder-push',
  '0 16 * * 1-5',
  $$
    select net.http_get(
      url     := 'https://brq.stvfamilymed.org/api/cron/qotd-reminder',
      headers := jsonb_build_object('Authorization', 'Bearer __PASTE_YOUR_CRON_SECRET_HERE__'),
      timeout_milliseconds := 30000
    );
  $$
);

-- 4. Noon push  -- 16:35 UTC = 12:35 PM Eastern (EDT), Mon-Fri
select cron.schedule(
  'qotd-noon-push',
  '35 16 * * 1-5',
  $$
    select net.http_get(
      url     := 'https://brq.stvfamilymed.org/api/cron/qotd-noon',
      headers := jsonb_build_object('Authorization', 'Bearer __PASTE_YOUR_CRON_SECRET_HERE__'),
      timeout_milliseconds := 30000
    );
  $$
);

-- ============================================================================
-- VERIFY  (run any time)
--   Confirm both jobs exist and are active:
--     select jobname, schedule, active from cron.job order by jobname;
--   See recent fires (after the first scheduled run):
--     select jobname, status, return_message, start_time
--       from cron.job_run_details order by start_time desc limit 10;
--
-- TEST RIGHT NOW  (sends the morning push immediately to all devices):
--   select net.http_get(
--     url     := 'https://brq.stvfamilymed.org/api/cron/qotd-morning',
--     headers := jsonb_build_object('Authorization', 'Bearer __PASTE_YOUR_CRON_SECRET_HERE__'),
--     timeout_milliseconds := 30000
--   );
--   Then, a few seconds later, check the response (200 = success):
--     select id, status_code, content from net._http_response order by id desc limit 5;
-- ============================================================================
