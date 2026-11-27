-- Seed new achievement badges across Care Dimensions, Flashcards, Remediation, QOTD, AP Milestones, and Volume Clubs
INSERT INTO public.badges (name, description, icon, type)
VALUES
  -- ABFM Care Dimensions
  ('Care Continuum',        'Answered questions across all 5 ABFM Care Dimensions.', '🧭', 'block'),
  ('Preventive Champion',   'Achieved 80% or higher accuracy across at least 20 Preventive Care questions.', '🛡️', 'block'),
  ('Acute Specialist',      'Achieved 80% or higher accuracy across at least 20 Acute Care and Diagnosis questions.', '🩺', 'block'),
  ('Chronic Care Steward',  'Achieved 80% or higher accuracy across at least 20 Chronic Care Management questions.', '📋', 'block'),
  ('Triage Ace',            'Achieved 80% or higher accuracy across at least 20 Emergent and Urgent Care questions.', '🚨', 'block'),
  ('Foundations Scholar',   'Achieved 80% or higher accuracy across at least 15 Foundations of Care questions.', '📚', 'block'),

  -- Leitner Flashcards
  ('Card Shark',            'Reviewed at least 25 flashcards in Leitner study mode.', '🃏', 'block'),
  ('Box 3 Graduate',        'Mastered 25 flashcards into Leitner Box 3.', '⭐', 'block'),
  ('Deck Sweeper',          'Mastered an entire Organ System or Care Dimension flashcard deck (10+ cards) into Box 3.', '🧹', 'block'),

  -- Remediation, Flagging & Growth
  ('Redemption Arc',        'Answered 10 previously missed questions correctly on a later attempt.', '🔄', 'block'),
  ('Flag & Conquer',        'Flagged a question for review and later answered it correctly.', '🚩', 'block'),
  ('Comeback Kid (Gold)',   'Improved your block score by 20% or more compared to your previous block.', '📈', 'block'),

  -- QOTD Depth & Social
  ('Sharpshooter II',       'Answered QOTD correctly 10 consecutive days in a row.', '🏹', 'qotd'),
  ('QOTD 60x Streak',       'Completed 60 Question of the Day challenges in a row.', '💎', 'qotd'),
  ('QOTD 100x Streak',      'Completed 100 Question of the Day challenges in a row. Unmatched consistency!', '🌠', 'qotd'),
  ('Engaged Peer',          'Reacted to 10 Question of the Day explanations after the noon reveal.', '💬', 'qotd'),
  ('Giant Slayer',          'Answered a QOTD correctly when fewer than 30% of peers got it right.', '🗿', 'qotd'),

  -- Academic Points, Attendance & Residency Milestones
  ('Century Club',          'Earned 100 Academic Points in an academic year.', '💯', 'general'),
  ('200 AP Milestone',      'Earned 200 cumulative Academic Points toward graduation.', '🎖️', 'general'),
  ('Graduation Ready (300 AP)', 'Reached the 300 Academic Points graduation milestone.', '🎓', 'general'),
  ('Conference Regular',    'Attended 10 or more conference sessions.', '🏛️', 'general'),
  ('Advisor Check-In',      'Completed and logged a faculty advisor check-in meeting.', '🤝', 'general'),
  ('Ahead of the Curve',    'Submitted 3 assigned curriculum blocks Early (at least 3 days before the due date).', '⏩', 'block'),

  -- High-Volume Question Clubs
  ('1.5k Club',             'Answered 1,500 total questions across blocks, custom quizzes, and QOTD.', '🚀', 'block'),
  ('2k Club',               'Answered 2,000 total questions across blocks, custom quizzes, and QOTD.', '🌌', 'block')
ON CONFLICT (name) DO NOTHING;
