-- =============================================================================
-- 20260608_techdebt_rls_functions.sql
-- =============================================================================
-- Purpose: 
-- 1. Captures live RLS policies for `results` and `question_attempts` in version control.
-- 2. Creates server-side SECURITY DEFINER aggregation functions `get_leaderboard_stats` 
--    and `get_qotd_cohort_stats` so non-admin residents can view the leaderboard and
--    cohort performance stats without exposing raw data rows.
-- =============================================================================

-- 1. Ensure RLS is enabled and capture live policies for `results`
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "results_admins_all" ON public.results;
CREATE POLICY "results_admins_all" ON public.results FOR ALL
USING (public.is_admin_or_faculty())
WITH CHECK (public.is_admin_or_faculty());

DROP POLICY IF EXISTS "results_self_select" ON public.results;
CREATE POLICY "results_self_select" ON public.results FOR SELECT
USING (user_id = auth.uid() OR legacy_email = auth.jwt()->>'email');

DROP POLICY IF EXISTS "results_self_insert" ON public.results;
CREATE POLICY "results_self_insert" ON public.results FOR INSERT
WITH CHECK (user_id = auth.uid() OR legacy_email = auth.jwt()->>'email');

DROP POLICY IF EXISTS "results_self_update" ON public.results;
CREATE POLICY "results_self_update" ON public.results FOR UPDATE
USING (user_id = auth.uid() OR legacy_email = auth.jwt()->>'email')
WITH CHECK (user_id = auth.uid() OR legacy_email = auth.jwt()->>'email');


-- 2. Ensure RLS is enabled and capture live policies for `question_attempts`
ALTER TABLE public.question_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qa_self_select" ON public.question_attempts;
CREATE POLICY "qa_self_select" ON public.question_attempts FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "qa_self_insert" ON public.question_attempts;
CREATE POLICY "qa_self_insert" ON public.question_attempts FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "qa_self_update" ON public.question_attempts;
CREATE POLICY "qa_self_update" ON public.question_attempts FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());


-- 3. Create Leaderboard Aggregation Function
-- Returns total points and total questions per user, grouped by legacy_email.
CREATE OR REPLACE FUNCTION public.get_leaderboard_stats(p_academic_year int DEFAULT NULL)
RETURNS TABLE (
    legacy_email text,
    total_points bigint,
    total_qs bigint
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH max_topic_points AS (
        SELECT r.legacy_email, r.topic, MAX(r.academic_points) as max_points
        FROM results r
        WHERE r.topic NOT ILIKE '%demo%'
          AND (p_academic_year IS NULL OR p_academic_year = 0 OR r.academic_year = p_academic_year)
        GROUP BY r.legacy_email, r.topic
    ),
    user_points AS (
        SELECT mtp.legacy_email, SUM(mtp.max_points) as total_points
        FROM max_topic_points mtp
        GROUP BY mtp.legacy_email
    ),
    user_qs AS (
        SELECT r.legacy_email, SUM(r.total) as total_qs
        FROM results r
        WHERE r.topic NOT ILIKE '%demo%'
          AND (p_academic_year IS NULL OR p_academic_year = 0 OR r.academic_year = p_academic_year)
        GROUP BY r.legacy_email
    )
    SELECT
        LOWER(up.legacy_email) as legacy_email,
        COALESCE(up.total_points, 0)::bigint as total_points,
        COALESCE(uq.total_qs, 0)::bigint as total_qs
    FROM user_points up
    JOIN user_qs uq ON LOWER(up.legacy_email) = LOWER(uq.legacy_email);
END;
$$;


-- 4. Create QOTD Cohort Stats Function
-- Returns total correct and incorrect answers for given question IDs when answered as QOTD.
CREATE OR REPLACE FUNCTION public.get_qotd_cohort_stats(p_question_ids uuid[])
RETURNS TABLE (
    question_id uuid,
    correct bigint,
    incorrect bigint
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        qa.question_id,
        COUNT(CASE WHEN qa.is_correct THEN 1 END)::bigint as correct,
        COUNT(CASE WHEN NOT qa.is_correct THEN 1 END)::bigint as incorrect
    FROM question_attempts qa
    WHERE qa.question_id = ANY(p_question_ids)
      AND qa.is_qotd = true
    GROUP BY qa.question_id;
END;
$$;
