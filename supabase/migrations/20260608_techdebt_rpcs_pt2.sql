CREATE OR REPLACE FUNCTION get_unused_questions(
  p_user_id uuid,
  p_categories text[] DEFAULT NULL,
  p_keywords text[] DEFAULT NULL,
  p_years text[] DEFAULT NULL,
  p_limit int DEFAULT 10
) RETURNS SETOF questions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT q.* FROM questions q
  WHERE 
    NOT EXISTS (
      SELECT 1 FROM question_attempts qa 
      WHERE qa.question_id = q.id AND qa.user_id = p_user_id
    )
    AND q.category != 'Demo'
    AND q.year != 'Demo'
    AND q.id NOT IN ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003')
    AND (p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR q.category = ANY(p_categories))
    AND (p_years IS NULL OR array_length(p_years, 1) IS NULL OR q.year = ANY(p_years))
    AND (
      p_keywords IS NULL OR array_length(p_keywords, 1) IS NULL OR 
      EXISTS (
        SELECT 1 FROM unnest(p_keywords) kw 
        WHERE q.question_text ILIKE '%' || kw || '%'
      )
    )
  ORDER BY RANDOM()
  LIMIT p_limit;
END;
$$;
