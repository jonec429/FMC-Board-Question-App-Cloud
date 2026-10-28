-- ============================================================================
-- 20261101_winter_est_pgcron.sql
-- Adjusts pg_cron UTC schedules for Standard Time (EST = UTC-5) starting Nov 1, 2026.
--
-- Monday-Friday Target Times:
--    * 8:30 AM EST  ->  13:30 UTC  ->  /api/cron/qotd-morning
--    * 12:00 PM EST ->  17:00 UTC  ->  /api/cron/qotd-reminder
--    * 12:35 PM EST ->  17:35 UTC  ->  /api/cron/qotd-noon
--
-- Instructions:
--   Run this in the Supabase SQL Editor on or around Sunday, Nov 1, 2026.
--   Remember to replace __PASTE_YOUR_CRON_SECRET_HERE__ with your CRON_SECRET.
-- ============================================================================

-- 1. Unschedule current EDT jobs
do $$ begin perform cron.unschedule('qotd-morning-push'); exception when others then null; end $$;
do $$ begin perform cron.unschedule('qotd-reminder-push'); exception when others then null; end $$;
do $$ begin perform cron.unschedule('qotd-noon-push'); exception when others then null; end $$;

-- 2. Morning push  -- 13:30 UTC = 8:30 AM EST, Mon-Fri
select cron.schedule(
  'qotd-morning-push',
  '30 13 * * 1-5',
  $$
    select net.http_get(
      url     := 'https://brq.stvfamilymed.org/api/cron/qotd-morning',
      headers := jsonb_build_object('Authorization', 'Bearer __PASTE_YOUR_CRON_SECRET_HERE__'),
      timeout_milliseconds := 30000
    );
  $$
);

-- 3. Reminder push  -- 17:00 UTC = 12:00 PM EST, Mon-Fri
select cron.schedule(
  'qotd-reminder-push',
  '0 17 * * 1-5',
  $$
    select net.http_get(
      url     := 'https://brq.stvfamilymed.org/api/cron/qotd-reminder',
      headers := jsonb_build_object('Authorization', 'Bearer __PASTE_YOUR_CRON_SECRET_HERE__'),
      timeout_milliseconds := 30000
    );
  $$
);

-- 4. Noon push  -- 17:35 UTC = 12:35 PM EST, Mon-Fri
select cron.schedule(
  'qotd-noon-push',
  '35 17 * * 1-5',
  $$
    select net.http_get(
      url     := 'https://brq.stvfamilymed.org/api/cron/qotd-noon',
      headers := jsonb_build_object('Authorization', 'Bearer __PASTE_YOUR_CRON_SECRET_HERE__'),
      timeout_milliseconds := 30000
    );
  $$
);
