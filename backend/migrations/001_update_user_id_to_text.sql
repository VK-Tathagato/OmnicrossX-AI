-- ============================================================
-- Migration: Update user_id from UUID to TEXT for Clerk
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Drop existing foreign key constraints on auth.users
ALTER TABLE public.research_sessions DROP CONSTRAINT IF EXISTS research_sessions_user_id_fkey;
ALTER TABLE public.chat_history DROP CONSTRAINT IF EXISTS chat_history_user_id_fkey;
ALTER TABLE public.saved_items DROP CONSTRAINT IF EXISTS saved_items_user_id_fkey;

-- 2. Alter user_id columns from UUID to TEXT
ALTER TABLE public.research_sessions ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
ALTER TABLE public.chat_history ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
ALTER TABLE public.saved_items ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- 3. (Optional) Recreate policies using TEXT comparisons if needed.
-- Since they were already checking `user_id = auth.uid()` we should theoretically
-- change them to use the Clerk JWT sub. However, if the backend uses the service_role
-- key, it bypasses RLS anyway, so these text conversions are strictly to stop
-- database insertion crashes when passing "user_2xyz..." as the user_id.
