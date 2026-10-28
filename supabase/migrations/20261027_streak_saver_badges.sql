-- Seed Streak Saver challenge badges (Tier 1, 2, and 3)
INSERT INTO public.badges (name, description, icon, type)
VALUES
  ('Streak Saver I',   'Rescued a broken daily streak by completing 10 questions from the most recent ITE.', '🛡️', 'qotd'),
  ('Streak Saver II',  'Rescued a second daily streak in an academic year by conquering 20 questions.', '⚡', 'qotd'),
  ('Streak Saver III', 'Rescued a third daily streak in an academic year by conquering 30 questions. True perseverance!', '👑', 'qotd')
ON CONFLICT (name) DO NOTHING;
