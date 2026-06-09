-- Add is_archived boolean column to the blocks table.
-- Default is false, meaning the block is active and visible.
-- Idempotent: safe to re-run.
ALTER TABLE blocks
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

-- If you need to manually archive any blocks immediately, you can do:
-- UPDATE blocks SET is_archived = TRUE WHERE title = 'Block 14: Transition to Practice';
