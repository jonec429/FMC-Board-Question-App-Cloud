-- Phase 2: Category-Based Block Logic Migration
-- Adds category_filters, block_type, question_count, academic_year, sort_order to blocks table

-- 1. Add new columns
ALTER TABLE public.blocks ADD COLUMN IF NOT EXISTS category_filters JSONB DEFAULT '[]';
ALTER TABLE public.blocks ADD COLUMN IF NOT EXISTS keyword_filters JSONB DEFAULT '[]';
ALTER TABLE public.blocks ADD COLUMN IF NOT EXISTS block_type TEXT DEFAULT 'assigned';
ALTER TABLE public.blocks ADD COLUMN IF NOT EXISTS question_count INTEGER DEFAULT 40;
ALTER TABLE public.blocks ADD COLUMN IF NOT EXISTS academic_year TEXT DEFAULT '2025-2026';
ALTER TABLE public.blocks ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- 2. Populate category mappings for existing blocks
-- Categories available in question bank:
--   Cardiovascular, Endocrine, Gastrointestinal, Hematologic/Immune,
--   Infectious Disease, Musculoskeletal, Nephrologic, Neurologic,
--   Population Health/Epidemiology, Psychiatric/Behavioral,
--   Pulmonary, Reproductive/Female, Skin/Subcutaneous, Special Sensory

UPDATE public.blocks SET
  block_type = 'demo',
  category_filters = '[]'::jsonb,
  sort_order = 0
WHERE title = 'Demo Quiz';

UPDATE public.blocks SET
  category_filters = '[]'::jsonb,
  keyword_filters = '["emergency department", "urgent care", "emergency room", "trauma center", "ambulance"]'::jsonb,
  sort_order = 1
WHERE title LIKE 'Block 1:%';

UPDATE public.blocks SET
  category_filters = '["Neurologic", "Psychiatric/Behavioral"]'::jsonb,
  sort_order = 2
WHERE title LIKE 'Block 2:%';

UPDATE public.blocks SET
  category_filters = '["Hematologic/Immune"]'::jsonb,
  sort_order = 3
WHERE title LIKE 'Block 3:%';

UPDATE public.blocks SET
  category_filters = '["Special Sensory"]'::jsonb,
  sort_order = 4
WHERE title LIKE 'Block 4:%';

UPDATE public.blocks SET
  category_filters = '["Cardiovascular"]'::jsonb,
  sort_order = 5
WHERE title LIKE 'Block 5:%';

UPDATE public.blocks SET
  category_filters = '["Pulmonary"]'::jsonb,
  sort_order = 6
WHERE title LIKE 'Block 6:%';

UPDATE public.blocks SET
  category_filters = '["Musculoskeletal"]'::jsonb,
  sort_order = 7
WHERE title LIKE 'Block 7:%';

UPDATE public.blocks SET
  category_filters = '["Nephrologic", "Gastrointestinal"]'::jsonb,
  sort_order = 8
WHERE title LIKE 'Block 8:%';

UPDATE public.blocks SET
  category_filters = '["Cardiovascular", "Pulmonary"]'::jsonb,
  sort_order = 9
WHERE title LIKE 'Block 9:%';

UPDATE public.blocks SET
  category_filters = '["Population Health/Epidemiology"]'::jsonb,
  sort_order = 10
WHERE title LIKE 'Block 10:%';

UPDATE public.blocks SET
  category_filters = '["Reproductive/Female"]'::jsonb,
  sort_order = 11
WHERE title LIKE 'Block 11:%';

UPDATE public.blocks SET
  block_type = 'bonus',
  category_filters = '["Skin/Subcutaneous"]'::jsonb,
  sort_order = 12
WHERE title LIKE 'Bonus Block: Dermatology%';

UPDATE public.blocks SET
  block_type = 'bonus',
  category_filters = '["Endocrine"]'::jsonb,
  sort_order = 13
WHERE title LIKE 'Bonus Block: Endocrinology%';
