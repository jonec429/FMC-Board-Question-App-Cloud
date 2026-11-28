-- =============================================================================
-- 20261127_hardening_and_rpcs.sql
-- =============================================================================
-- Safe, additive, idempotent migration for:
--   1. Case-insensitive is_admin_or_faculty() (incl. track = 'faculty', gme_staff)
--   2. Updating get_resident_attempt_metrics() & assigned_quizzes RLS to use
--      is_admin_or_faculty() instead of profiles.role
--   3. Normalizing email casing & user_id fallback inside get_leaderboard_stats()
--   4. Lightweight server-side RPC get_user_achievement_progress() for
--      Redemption Arc, chronological Flag & Conquer, and ABFM Care Dimensions
--   5. Aligning Comeback Kid / Ahead of the Curve badge descriptions
--   6. Cloud-persisted resident_exam_scores table for Board Readiness (Beta)
-- =============================================================================

-- 1. Harden is_admin_or_faculty() with case-insensitive email & track check
CREATE OR REPLACE FUNCTION public.is_admin_or_faculty()
RETURNS BOOLEAN AS $$
DECLARE
  user_email TEXT;
  auth_role TEXT;
  auth_pgy TEXT;
  auth_track TEXT;
BEGIN
  user_email := LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', '')));

  IF user_email IN ('jonathan.carbungco@ascension.org', 'j.carbungco1@gmail.com') THEN
    RETURN true;
  END IF;

  SELECT LOWER(TRIM(COALESCE(role, ''))), LOWER(TRIM(COALESCE(pgy, ''))), LOWER(TRIM(COALESCE(track, '')))
  INTO auth_role, auth_pgy, auth_track
  FROM public.authorized_roster
  WHERE LOWER(TRIM(email)) = user_email
  LIMIT 1;

  IF auth_role IN ('admin', 'faculty', 'gme_staff')
     OR auth_pgy = 'faculty'
     OR auth_track = 'faculty' THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;


-- 2. Update get_resident_attempt_metrics() to use is_admin_or_faculty()
CREATE OR REPLACE FUNCTION public.get_resident_attempt_metrics()
RETURNS TABLE (
  user_id UUID,
  first_pass_correct BIGINT,
  first_pass_total BIGINT,
  best_correct BIGINT,
  best_total BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_priv BOOLEAN;
BEGIN
  is_priv := public.is_admin_or_faculty();

  RETURN QUERY
  WITH filtered AS (
    SELECT
      qa.user_id,
      qa.question_id,
      qa.is_correct,
      qa.created_at,
      ROW_NUMBER() OVER (
        PARTITION BY qa.user_id, qa.question_id
        ORDER BY qa.created_at ASC, qa.id ASC
      ) AS rn
    FROM public.question_attempts qa
    WHERE COALESCE(qa.is_qotd, false) = false
      AND qa.question_id IS NOT NULL
      AND (
        is_priv
        OR qa.user_id = auth.uid()
      )
  ),
  per_question AS (
    SELECT
      f.user_id,
      f.question_id,
      BOOL_OR(CASE WHEN f.rn = 1 THEN f.is_correct ELSE false END) AS first_correct,
      BOOL_OR(f.is_correct) AS any_correct
    FROM filtered f
    GROUP BY f.user_id, f.question_id
  )
  SELECT
    pq.user_id,
    COUNT(*) FILTER (WHERE pq.first_correct) AS first_pass_correct,
    COUNT(*) AS first_pass_total,
    COUNT(*) FILTER (WHERE pq.any_correct) AS best_correct,
    COUNT(*) AS best_total
  FROM per_question pq
  GROUP BY pq.user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_resident_attempt_metrics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_resident_attempt_metrics() TO authenticated;


-- 3. Update assigned_quizzes policies to use is_admin_or_faculty() (only if table exists)
DO $$
BEGIN
  IF to_regclass('public.assigned_quizzes') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins and Faculty can view all assigned quizzes" ON public.assigned_quizzes';
    EXECUTE 'CREATE POLICY "Admins and Faculty can view all assigned quizzes" ON public.assigned_quizzes FOR SELECT USING (public.is_admin_or_faculty())';

    EXECUTE 'DROP POLICY IF EXISTS "Admins and Faculty can assign quizzes" ON public.assigned_quizzes';
    EXECUTE 'CREATE POLICY "Admins and Faculty can assign quizzes" ON public.assigned_quizzes FOR INSERT WITH CHECK (public.is_admin_or_faculty())';

    EXECUTE 'DROP POLICY IF EXISTS "Admins and Faculty can update assigned quizzes" ON public.assigned_quizzes';
    EXECUTE 'CREATE POLICY "Admins and Faculty can update assigned quizzes" ON public.assigned_quizzes FOR UPDATE USING (public.is_admin_or_faculty())';

    EXECUTE 'DROP POLICY IF EXISTS "Admins and Faculty can delete assigned quizzes" ON public.assigned_quizzes';
    EXECUTE 'CREATE POLICY "Admins and Faculty can delete assigned quizzes" ON public.assigned_quizzes FOR DELETE USING (public.is_admin_or_faculty())';
  END IF;
END
$$;


-- 4. Normalize email casing and support user_id fallback in get_leaderboard_stats()
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
    WITH base_results AS (
        SELECT
            LOWER(TRIM(COALESCE(NULLIF(r.legacy_email, ''), p.email))) AS norm_email,
            r.topic,
            r.academic_points,
            r.total
        FROM public.results r
        LEFT JOIN public.profiles p ON p.id = r.user_id
        WHERE r.topic NOT ILIKE '%demo%'
          AND COALESCE(NULLIF(r.legacy_email, ''), p.email) IS NOT NULL
          AND (p_academic_year IS NULL OR p_academic_year = 0 OR r.academic_year = p_academic_year)
    ),
    max_topic_points AS (
        SELECT br.norm_email, MAX(br.academic_points) AS max_points
        FROM base_results br
        WHERE br.topic NOT ILIKE '%[Attendance]%' AND br.topic NOT ILIKE '%[Manual]%'
        GROUP BY br.norm_email, br.topic
    ),
    block_pts AS (
        SELECT mtp.norm_email, SUM(mtp.max_points) AS total_block_pts
        FROM max_topic_points mtp
        GROUP BY mtp.norm_email
    ),
    combined_add_pts AS (
        SELECT br.norm_email, br.academic_points AS pts
        FROM base_results br
        WHERE br.topic ILIKE '%[Attendance]%' OR br.topic ILIKE '%[Manual]%'
    ),
    add_pts AS (
        SELECT cap.norm_email, SUM(cap.pts) AS total_add_pts
        FROM combined_add_pts cap
        GROUP BY cap.norm_email
    ),
    qs_cnt AS (
        SELECT br.norm_email, SUM(br.total) AS total_qs
        FROM base_results br
        GROUP BY br.norm_email
    ),
    emails AS (
        SELECT b.norm_email FROM block_pts b
        UNION
        SELECT a.norm_email FROM add_pts a
        UNION
        SELECT q.norm_email FROM qs_cnt q
    )
    SELECT
        e.norm_email AS legacy_email,
        (COALESCE(bp.total_block_pts, 0) + COALESCE(ap.total_add_pts, 0))::bigint AS total_points,
        COALESCE(q.total_qs, 0)::bigint AS total_qs
    FROM emails e
    LEFT JOIN block_pts bp ON e.norm_email = bp.norm_email
    LEFT JOIN add_pts ap ON e.norm_email = ap.norm_email
    LEFT JOIN qs_cnt q ON e.norm_email = q.norm_email;
END;
$$;


-- 5. Lightweight RPC for user achievement progress (avoids shipping all lifetime attempts)
CREATE OR REPLACE FUNCTION public.get_user_achievement_progress()
RETURNS TABLE (
  redeemed_count BIGINT,
  flag_and_conquer_earned BOOLEAN,
  care_dimension_stats JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  v_redeemed BIGINT := 0;
  v_flag_conquer BOOLEAN := false;
  v_care_stats JSONB := '{}'::jsonb;
BEGIN
  IF uid IS NULL THEN
    RETURN QUERY SELECT 0::bigint, false, '{}'::jsonb;
    RETURN;
  END IF;

  -- Redemption Arc: distinct questions missed earlier and later answered correctly
  WITH ordered_attempts AS (
    SELECT
      qa.question_id,
      qa.is_correct,
      qa.created_at,
      BOOL_OR(NOT qa.is_correct) OVER (
        PARTITION BY qa.question_id
        ORDER BY qa.created_at ASC, qa.id ASC
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
      ) AS had_prior_wrong
    FROM public.question_attempts qa
    WHERE qa.user_id = uid
      AND qa.question_id IS NOT NULL
  )
  SELECT COUNT(DISTINCT oa.question_id)
  INTO v_redeemed
  FROM ordered_attempts oa
  WHERE oa.is_correct = true AND COALESCE(oa.had_prior_wrong, false) = true;

  -- Flag & Conquer: flagged first, then answered correctly afterward
  IF to_regclass('public.user_flagged_questions') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT EXISTS (
        SELECT 1
        FROM public.user_flagged_questions ufq
        JOIN public.question_attempts qa
          ON qa.user_id = ufq.user_id
         AND qa.question_id::text = ufq.question_id::text
        WHERE ufq.user_id = $1
          AND qa.is_correct = true
          AND qa.created_at > ufq.created_at
      )
    $sql$
    INTO v_flag_conquer
    USING uid;
  END IF;

  -- ABFM Care Dimension aggregates
  SELECT COALESCE(
    jsonb_object_agg(
      dim_row.abfm_category,
      jsonb_build_object('total', dim_row.total_cnt, 'correct', dim_row.correct_cnt)
    ),
    '{}'::jsonb
  )
  INTO v_care_stats
  FROM (
    SELECT
      q.abfm_category,
      COUNT(*) AS total_cnt,
      COUNT(*) FILTER (WHERE qa.is_correct) AS correct_cnt
    FROM public.question_attempts qa
    JOIN public.questions q ON q.id::text = qa.question_id::text
    WHERE qa.user_id = uid
      AND q.abfm_category IS NOT NULL
      AND q.abfm_category <> ''
    GROUP BY q.abfm_category
  ) dim_row;

  RETURN QUERY SELECT COALESCE(v_redeemed, 0), COALESCE(v_flag_conquer, false), COALESCE(v_care_stats, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_achievement_progress() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_achievement_progress() TO authenticated;


-- 6. Align badge descriptions so Comeback Kid (15%) & Ahead of the Curve match logic
UPDATE public.badges
SET description = 'Improved your block score by 15% or more compared to your last block!'
WHERE name = 'Comeback Kid';

UPDATE public.badges
SET description = 'Submitted 3 assigned curriculum blocks Early (before the block start date).'
WHERE name = 'Ahead of the Curve';


-- 7. Cloud persistence for Board Readiness ITE & licensing exam scores
CREATE TABLE IF NOT EXISTS public.resident_exam_scores (
  resident_email TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  exam_type TEXT NOT NULL DEFAULT 'USMLE',
  step2_score INTEGER,
  comlex2_score INTEGER,
  pgy1_ite INTEGER,
  pgy2_ite INTEGER,
  pgy3_ite INTEGER,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.resident_exam_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "resident_exam_scores_select" ON public.resident_exam_scores;
CREATE POLICY "resident_exam_scores_select" ON public.resident_exam_scores
  FOR SELECT TO authenticated
  USING (
    LOWER(TRIM(resident_email)) = LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', '')))
    OR user_id = auth.uid()
    OR public.is_admin_or_faculty()
  );

DROP POLICY IF EXISTS "resident_exam_scores_insert" ON public.resident_exam_scores;
CREATE POLICY "resident_exam_scores_insert" ON public.resident_exam_scores
  FOR INSERT TO authenticated
  WITH CHECK (
    LOWER(TRIM(resident_email)) = LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', '')))
    OR user_id = auth.uid()
    OR public.is_admin_or_faculty()
  );

DROP POLICY IF EXISTS "resident_exam_scores_update" ON public.resident_exam_scores;
CREATE POLICY "resident_exam_scores_update" ON public.resident_exam_scores
  FOR UPDATE TO authenticated
  USING (
    LOWER(TRIM(resident_email)) = LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', '')))
    OR user_id = auth.uid()
    OR public.is_admin_or_faculty()
  )
  WITH CHECK (
    LOWER(TRIM(resident_email)) = LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', '')))
    OR user_id = auth.uid()
    OR public.is_admin_or_faculty()
  );
