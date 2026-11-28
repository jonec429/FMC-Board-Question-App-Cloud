-- ============================================================================
-- 20261127_pgcron_jitter_fix.sql
--
-- JITTER-PROOF + DST-PROOF PG_CRON SCHEDULES FOR SUPABASE (AMERICA/NEW_YORK)
--
-- Replaces exact-minute `to_char(..., 'HH24:MI') = '08:30'` checks with
-- hour-level checks (`extract(hour from now() at time zone 'America/New_York') = 8`).
-- Because the cron schedule already pins the minute (e.g. '30 12,13 * * 1-5'),
-- 1-2 minutes of pg_cron scheduler jitter (e.g. firing at 08:31 instead of 08:30)
-- will no longer silently drop the entire day's job!
--
-- INSTRUCTIONS:
--   No copy-paste needed! This script automatically reads your existing
--   CRON_SECRET from `cron.job` in Supabase and re-applies it to all jobs.
--   Just run this in the Supabase SQL Editor.
-- ============================================================================

do $do$
declare
  v_secret text;
begin
  -- 1. Extract the existing Bearer token already saved in cron.job
  select trim(substring(command from 'Bearer ([^''"\\]+)'))
    into v_secret
    from cron.job
   where command like '%Bearer %'
     and command not like '%__PASTE_%'
   order by jobid
   limit 1;

  if v_secret is null or v_secret = '' then
    raise exception 'Could not find an existing Bearer token in cron.job. Grab CRON_SECRET from Vercel -> Settings -> Environment Variables (or your local .env.local), then inspect cron.job or paste it manually.';
  end if;

  -- 2. Unschedule old jobs safely
  begin perform cron.unschedule('qotd-morning-push'); exception when others then null; end;
  begin perform cron.unschedule('qotd-reminder-push'); exception when others then null; end;
  begin perform cron.unschedule('qotd-noon-push'); exception when others then null; end;
  begin perform cron.unschedule('faculty-digest-push'); exception when others then null; end;
  begin perform cron.unschedule('block-reminders-push'); exception when others then null; end;
  begin perform cron.unschedule('take_leaderboard_snapshot_job'); exception when others then null; end;

  -- 3. Re-schedule all jobs with hour-level ET checks + reused Bearer token

  -- Morning QOTD push -- 8:30 AM Eastern Time (EDT: 12:30 UTC / EST: 13:30 UTC), Mon-Fri
  perform cron.schedule(
    'qotd-morning-push',
    '30 12,13 * * 1-5',
    format(
      $cmd$
        select net.http_get(
          url     := 'https://brq.stvfamilymed.org/api/cron/qotd-morning',
          headers := jsonb_build_object('Authorization', %L),
          timeout_milliseconds := 30000
        )
        where extract(hour from (now() at time zone 'America/New_York')) = 8;
      $cmd$,
      'Bearer ' || v_secret
    )
  );

  -- Reminder QOTD push -- 12:00 PM Eastern Time (EDT: 16:00 UTC / EST: 17:00 UTC), Mon-Fri
  perform cron.schedule(
    'qotd-reminder-push',
    '0 16,17 * * 1-5',
    format(
      $cmd$
        select net.http_get(
          url     := 'https://brq.stvfamilymed.org/api/cron/qotd-reminder',
          headers := jsonb_build_object('Authorization', %L),
          timeout_milliseconds := 30000
        )
        where extract(hour from (now() at time zone 'America/New_York')) = 12;
      $cmd$,
      'Bearer ' || v_secret
    )
  );

  -- Noon QOTD release push -- 12:35 PM Eastern Time (EDT: 16:35 UTC / EST: 17:35 UTC), Mon-Fri
  perform cron.schedule(
    'qotd-noon-push',
    '35 16,17 * * 1-5',
    format(
      $cmd$
        select net.http_get(
          url     := 'https://brq.stvfamilymed.org/api/cron/qotd-noon',
          headers := jsonb_build_object('Authorization', %L),
          timeout_milliseconds := 30000
        )
        where extract(hour from (now() at time zone 'America/New_York')) = 12;
      $cmd$,
      'Bearer ' || v_secret
    )
  );

  -- Faculty Advisor Digest push -- 9:00 AM Eastern Time (EDT: 13:00 UTC / EST: 14:00 UTC), Mondays
  perform cron.schedule(
    'faculty-digest-push',
    '0 13,14 * * 1',
    format(
      $cmd$
        select net.http_get(
          url     := 'https://brq.stvfamilymed.org/api/cron/faculty-digest',
          headers := jsonb_build_object('Authorization', %L),
          timeout_milliseconds := 30000
        )
        where extract(hour from (now() at time zone 'America/New_York')) = 9;
      $cmd$,
      'Bearer ' || v_secret
    )
  );

  -- Block Reminders push/email -- 9:00 AM Eastern Time (EDT: 13:00 UTC / EST: 14:00 UTC), Thursdays
  perform cron.schedule(
    'block-reminders-push',
    '0 13,14 * * 4',
    format(
      $cmd$
        select net.http_get(
          url     := 'https://brq.stvfamilymed.org/api/cron/block-reminders',
          headers := jsonb_build_object('Authorization', %L),
          timeout_milliseconds := 30000
        )
        where extract(hour from (now() at time zone 'America/New_York')) = 9;
      $cmd$,
      'Bearer ' || v_secret
    )
  );

  -- Leaderboard Snapshot -- Midnight Eastern Time on 1st of every month (EDT: 04:00 UTC / EST: 05:00 UTC)
  perform cron.schedule(
    'take_leaderboard_snapshot_job',
    '0 4,5 1 * *',
    $snap$
      select public.take_leaderboard_snapshot()
      where extract(hour from (now() at time zone 'America/New_York')) = 0;
    $snap$
  );
end
$do$;

select jobid, jobname, schedule, active, command from cron.job order by jobname;
