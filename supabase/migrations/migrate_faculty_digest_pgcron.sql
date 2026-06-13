-- ============================================================================
-- migrate_faculty_digest_pgcron.sql
-- Punctual Faculty Advisor Digest push notifications via pg_cron.
--
-- WHAT IT SCHEDULES (Every Monday):
--    * 13:00 UTC  ->  9:00 AM Eastern (EDT)  ->  /api/cron/faculty-digest
--   NOTE ON DST: this is fixed UTC time. In winter (EST) it lands at 8:00 AM.
--
-- -------------------------------------------------------------------------
-- BEFORE YOU RUN THIS:
--   1. Replace  __PASTE_YOUR_CRON_SECRET_HERE__  with the exact value of CRON_SECRET from your Vercel project settings.
--   2. If your live site is NOT https://brq.stvfamilymed.org, fix the URL too.
-- ============================================================================

do $$ begin perform cron.unschedule('faculty-digest-push'); exception when others then null; end $$;

select cron.schedule(
  'faculty-digest-push',
  '0 13 * * 1',
  $$
    select net.http_get(
      url     := 'https://brq.stvfamilymed.org/api/cron/faculty-digest',
      headers := jsonb_build_object('Authorization', 'Bearer __PASTE_YOUR_CRON_SECRET_HERE__'),
      timeout_milliseconds := 30000
    );
  $$
);

-- VERIFY
-- select jobname, schedule, active from cron.job order by jobname;
