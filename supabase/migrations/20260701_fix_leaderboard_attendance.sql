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
        SELECT r.legacy_email, r.topic, r.academic_points, r.total
        FROM results r
        WHERE r.topic NOT ILIKE '%demo%'
          AND (p_academic_year IS NULL OR p_academic_year = 0 OR r.academic_year = p_academic_year)
    ),
    max_topic_points AS (
        SELECT br.legacy_email, MAX(br.academic_points) as max_points
        FROM base_results br
        WHERE br.topic NOT ILIKE '%[Attendance]%' AND br.topic NOT ILIKE '%[Manual]%'
        GROUP BY br.legacy_email, br.topic
    ),
    block_pts AS (
        SELECT mtp.legacy_email, SUM(mtp.max_points) as total_block_pts
        FROM max_topic_points mtp
        GROUP BY mtp.legacy_email
    ),
    add_pts AS (
        SELECT br.legacy_email, SUM(br.academic_points) as total_add_pts
        FROM base_results br
        WHERE br.topic ILIKE '%[Attendance]%' OR br.topic ILIKE '%[Manual]%'
        GROUP BY br.legacy_email
    ),
    qs_cnt AS (
        SELECT br.legacy_email, SUM(br.total) as total_qs
        FROM base_results br
        GROUP BY br.legacy_email
    ),
    emails AS (
        SELECT b.legacy_email FROM block_pts b
        UNION
        SELECT a.legacy_email FROM add_pts a
        UNION
        SELECT q.legacy_email FROM qs_cnt q
    )
    SELECT 
        LOWER(e.legacy_email) as legacy_email,
        (COALESCE(bp.total_block_pts, 0) + COALESCE(ap.total_add_pts, 0))::bigint as total_points,
        COALESCE(q.total_qs, 0)::bigint as total_qs
    FROM emails e
    LEFT JOIN block_pts bp ON e.legacy_email = bp.legacy_email
    LEFT JOIN add_pts ap ON e.legacy_email = ap.legacy_email
    LEFT JOIN qs_cnt q ON e.legacy_email = q.legacy_email;
END;
$$;
