-- Badge catalog expansion (2026-06-08).
--
-- 1) Removes the orphaned "Marathoner" badge — it duplicated "100 Club" (both
--    "answered 100 questions") and was never actually awarded by the app.
-- 2) Adds the new achievements. Earning logic lives in lib/gamification.ts; this
--    just seeds the catalog so the Achievements modal can show them (locked until
--    earned). Idempotent: safe to re-run (ON CONFLICT DO NOTHING + guarded DELETE).
--
-- Note: "Topic Master: <Category>" badges stay dynamic (created on earn by the app)
-- and are NOT seeded here. Their meaning changed to "every question in the category
-- across the 3 most recent ITEs" — handled entirely in lib/gamification.ts.

INSERT INTO public.badges (name, description, icon, type)
VALUES
  ('Ironman',         'Answered 140 total questions — the distance of an Ironman triathlon (140.6 miles).', '🏊', 'block'),
  ('On a Roll',       'Submitted 3 assigned blocks on time in a row.',                                      '🎳', 'block'),
  ('Locked In',       'Submitted 5 assigned blocks on time in a row.',                                      '🔒', 'block'),
  ('Unstoppable',     'Submitted 10 assigned blocks on time in a row.',                                     '⚡', 'block'),
  ('Sharpshooter',    'Answered the Question of the Day correctly 5 days in a row.',                         '🎯', 'qotd'),
  ('Early Bird',      'Completed a block between 4 and 6 AM.',                                               '🌅', 'block'),
  ('Weekend Warrior', 'Completed a block on a Saturday or Sunday.',                                          '⚔️', 'block'),
  ('Perfectionist',   'Scored 100% on 5 different blocks.',                                                  '💯', 'block'),
  ('Procrastinator',  'Turned in an assigned block on its last day (or the day before).',                   '🐢', 'block')
ON CONFLICT (name) DO NOTHING;

-- Retime "Just in Time": the QOTD now unlocks at 12:30 PM, so the badge fires in
-- the 5 minutes before that (was worded for just-before-noon). Logic is in
-- lib/gamification.ts; this just refreshes the catalog description shown to residents.
UPDATE public.badges
SET description = 'Answered the Question of the Day between 12:25 and 12:29 PM — right before the 12:30 unlock.'
WHERE name = 'Just in Time';

-- Retire the duplicate. (FK from user_badges is ON DELETE CASCADE; nobody held it
-- anyway since it was never awarded, so this removes zero earned badges.)
DELETE FROM public.badges WHERE name = 'Marathoner';
