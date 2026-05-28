-- fix_null_archived_blocks.sql
-- Fixes any blocks that were created where is_archived was accidentally left NULL

UPDATE public.blocks 
SET is_archived = false 
WHERE is_archived IS NULL;
