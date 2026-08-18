-- Update badge descriptions and add Streak Master
INSERT INTO public.badges (name, description, icon, type)
VALUES 
  ('Comeback Kid', 'Improved block performance by 15% or more compared to the previous block.', '🏆', 'block'),
  ('Night Owl', 'Completed questions or a block late at night (10pm – 4am).', '🦉', 'general'),
  ('Early Bird', 'Completed questions or a block early in the morning (before 7am).', '🌅', 'general'),
  ('Streak Master', 'Maintained a 10-day QOTD streak or 5-block on-time streak.', '👑', 'streak')
ON CONFLICT (name) DO UPDATE 
SET description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    type = EXCLUDED.type;
