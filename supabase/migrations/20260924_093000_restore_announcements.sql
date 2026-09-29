-- Restore the legacy member-news data model for the new Super Admin panel.
-- Apply to TEST first. Existing Production data and schema are NOT modified here.
CREATE TABLE IF NOT EXISTS public.bgm_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  category text DEFAULT 'Update',
  image_url text,
  button_text text,
  button_url text,
  active boolean NOT NULL DEFAULT true,
  start_date date,
  end_date date,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bgm_announcements_dates_valid CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date)
);
ALTER TABLE public.bgm_announcements ENABLE ROW LEVEL SECURITY;
-- All writes and admin reads use authenticated server handlers with the service role.
-- The public member-facing news handler returns only active announcements in date range.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('bgm-announcements','bgm-announcements',true,5242880,ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;
