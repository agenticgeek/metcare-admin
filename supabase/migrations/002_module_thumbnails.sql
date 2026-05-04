-- MET Academy — Full public URL for each module's video thumbnail (Supabase Storage).
-- Run in Supabase SQL Editor after 001_initial_schema.sql, or via CLI.

ALTER TABLE public.modules
  ADD COLUMN IF NOT EXISTS thumbnail_url text;

COMMENT ON COLUMN public.modules.thumbnail_url IS 'Public Storage URL for the thumbnail image (saved after upload).';
