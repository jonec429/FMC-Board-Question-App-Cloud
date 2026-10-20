-- Seed new challenge badges with precise Systems Category terminology
INSERT INTO public.badges (name, description, icon, type)
VALUES
  ('Systems Explorer', 'Answered questions across all 14 clinical Systems categories.', '🩺', 'block'),
  ('Repeat Master',    'Scored 100% on a custom quiz of High-Yield Repeat questions.', '🔁', 'block'),
  ('Pearl Diver',      'Reviewed 25 question rationales and Board Prep Gems.', '💡', 'block'),
  ('ITE Sprint',       'Answered 100 questions during the fall ITE preparation season.', '🏆', 'block')
ON CONFLICT (name) DO NOTHING;
