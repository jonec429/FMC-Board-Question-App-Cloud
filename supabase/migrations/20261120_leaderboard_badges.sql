-- Seed leaderboard achievement badges so they display as locked targets in Achievements
INSERT INTO public.badges (name, description, icon, type)
VALUES
  ('Leaderboard Contender', 'Reached the Top 5 on the program Academic Points leaderboard.', '📈', 'general'),
  ('Podium Finisher',       'Reached the Top 3 podium on the program Academic Points leaderboard.', '🏅', 'general'),
  ('Top of the Class',      'Claimed the #1 spot on the program Academic Points leaderboard.', '👑', 'general'),
  ('Has-Been',              'Previously made the Top 5 Leaderboard, then slipped out of contention.', '🍂', 'general')
ON CONFLICT (name) DO NOTHING;
