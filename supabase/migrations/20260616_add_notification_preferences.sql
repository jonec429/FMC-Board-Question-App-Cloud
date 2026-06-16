-- Migration: Add notification_preferences to profiles table
-- This allows granular opt-out of specific push notifications.

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"qotd": true, "qotd_reminder": true, "block_reminders": true}'::jsonb;
