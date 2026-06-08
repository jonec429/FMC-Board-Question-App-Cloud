-- QOTD: "frozen past, fresh future" top-up + recycle guardrail.
--
-- Context: qotd_schedule maps each weekday to exactly one question. New ITE
-- questions imported each year do NOT appear in the daily until the schedule is
-- extended. This migration provides that extension safely:
--
--   1. UNIQUE(question_id) guardrail — a question can never be scheduled on two
--      different days, so a recycle is impossible even by accident.
--   2. qotd_topup() — rebuilds ONLY the future (schedule_date > today), drawing
--      from questions that have never been scheduled AND never been answered as a
--      QOTD, newest ITE year first. Past + today are immutable, so history is never
--      disturbed and nobody is re-served a question they've already seen.
--
-- Idempotent: safe to re-run. qotd_topup() can be re-run any time (e.g. after each
-- annual import) and will simply re-derive the future from the current question pool.

-- 1) Recycle guardrail. (Audit confirmed no current duplicates, so this is clean.)
ALTER TABLE public.qotd_schedule
  DROP CONSTRAINT IF EXISTS qotd_schedule_question_id_unique;
ALTER TABLE public.qotd_schedule
  ADD CONSTRAINT qotd_schedule_question_id_unique UNIQUE (question_id);

-- 2) The top-up function.
CREATE OR REPLACE FUNCTION public.qotd_topup()
RETURNS TABLE(added integer, last_day date)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur_date date;
  q record;
  cnt integer := 0;
BEGIN
  -- Freeze the past and today; rebuild only future dates.
  DELETE FROM public.qotd_schedule WHERE schedule_date > CURRENT_DATE;

  -- First open slot = the next weekday after today.
  cur_date := CURRENT_DATE + 1;
  WHILE EXTRACT(ISODOW FROM cur_date) > 5 LOOP
    cur_date := cur_date + 1;
  END LOOP;

  -- Walk the never-used question pool, newest ITE year first, one per weekday.
  FOR q IN
    SELECT id
    FROM public.questions
    WHERE year IS NOT NULL
      AND year NOT IN ('Demo', 'Unspecified')
      AND COALESCE(category, '') <> 'Demo'
      AND id NOT IN (SELECT question_id FROM public.qotd_schedule)               -- never scheduled (incl. frozen past)
      AND id NOT IN (SELECT question_id FROM public.question_attempts WHERE is_qotd IS TRUE) -- never shown as a QOTD
    ORDER BY year DESC, id ASC
  LOOP
    INSERT INTO public.qotd_schedule (schedule_date, question_id)
    VALUES (cur_date, q.id);
    cnt := cnt + 1;

    cur_date := cur_date + 1;
    WHILE EXTRACT(ISODOW FROM cur_date) > 5 LOOP
      cur_date := cur_date + 1;
    END LOOP;
  END LOOP;

  RETURN QUERY
    SELECT cnt, (SELECT MAX(schedule_date) FROM public.qotd_schedule);
END;
$$;

-- Only the service role (used by the admin-only API route) may execute this.
REVOKE ALL ON FUNCTION public.qotd_topup() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.qotd_topup() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qotd_topup() TO service_role;
