-- 1. Insert New Badges
INSERT INTO public.badges (name, description, icon, type)
VALUES 
  ('Half Iron Man', 'Answered 70 total questions.', '🏊‍♂️', 'block'),
  ('Comeback Kid', 'Improved block performance by 20% compared to the previous block.', '🚀', 'block'),
  ('Top of the Class', 'Maintained the most academic points in the program for 3 consecutive months.', '👑', 'block')
ON CONFLICT (name) DO NOTHING;

-- 2. Create Leaderboard Snapshots Table
CREATE TABLE IF NOT EXISTS public.leaderboard_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_date DATE NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    legacy_email TEXT NOT NULL,
    total_points INTEGER NOT NULL,
    rank INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE public.leaderboard_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view leaderboard snapshots" ON public.leaderboard_snapshots FOR SELECT USING (true);

-- 3. Create Function for Snapshot and Badge Awarding
CREATE OR REPLACE FUNCTION public.take_leaderboard_snapshot()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_snapshot_date DATE := CURRENT_DATE;
BEGIN
    -- Insert snapshot for everyone
    INSERT INTO public.leaderboard_snapshots (snapshot_date, user_id, legacy_email, total_points, rank)
    SELECT 
        current_snapshot_date,
        p.id as user_id,
        s.legacy_email,
        s.total_points,
        RANK() OVER (ORDER BY s.total_points DESC) as rank
    FROM public.get_leaderboard_stats() s
    LEFT JOIN public.profiles p ON p.email = s.legacy_email;

    -- Award 'Top of the Class' badge
    -- For users who are rank 1 in the current snapshot, AND rank 1 in the snapshot 1 month ago, AND rank 1 in the snapshot 2 months ago.
    INSERT INTO public.user_badges (user_id, badge_id)
    SELECT 
        u.user_id,
        (SELECT id FROM public.badges WHERE name = 'Top of the Class')
    FROM (
        SELECT user_id
        FROM public.leaderboard_snapshots
        WHERE rank = 1
        GROUP BY user_id
        HAVING 
            COUNT(CASE WHEN snapshot_date >= current_snapshot_date - INTERVAL '65 days' THEN 1 END) >= 3
    ) u
    WHERE u.user_id IS NOT NULL
    ON CONFLICT (user_id, badge_id) DO NOTHING;

END;
$$;

-- 4. Schedule pg_cron Job (1st of every month at midnight UTC)
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('take_leaderboard_snapshot_job', '0 0 1 * *', 'SELECT public.take_leaderboard_snapshot()');
