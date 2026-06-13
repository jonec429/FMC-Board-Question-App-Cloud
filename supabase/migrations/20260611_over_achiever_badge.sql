-- Adds the "Over Achiever" badge to the catalog so it appears as a locked achievement.
-- The earning logic is handled in lib/gamification.ts.

INSERT INTO public.badges (name, description, icon, type)
VALUES (
  'Over Achiever',
  'Unlocked every standard achievement in the app. Incredible work!',
  '👑',
  'block'
)
ON CONFLICT (name) DO NOTHING;
