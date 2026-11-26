-- Migration: Server-side aggregation RPC for resident Global First-Pass & Best-Attempt metrics
-- Avoids shipping all raw question_attempts rows to the browser (protects Supabase egress).
-- Excludes QOTD attempts (is_qotd = true) and deduplicates by question_id per user.

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
  caller_role TEXT;
BEGIN
  SELECT LOWER(COALESCE(p.role, '')) INTO caller_role
  FROM public.profiles p
  WHERE p.id = auth.uid();

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
        caller_role IN ('admin', 'faculty')
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
