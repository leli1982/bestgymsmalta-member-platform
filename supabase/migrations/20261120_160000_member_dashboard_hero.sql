-- Member home-page hero artwork: TEST first, then an explicit production gate.
-- Uploads live in the existing public bgm-announcements Storage bucket under home-hero/.
-- This table contains only one public-image path; no member data or credentials.
CREATE TABLE IF NOT EXISTS public.bgm_member_dashboard_hero (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  image_path text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT bgm_member_dashboard_hero_safe_path CHECK (
    image_path IS NULL OR
    image_path ~ '^home-hero/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](jpg|png|webp)$'
  )
);
ALTER TABLE public.bgm_member_dashboard_hero ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.bgm_member_dashboard_hero FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.bgm_member_dashboard_hero TO service_role;
INSERT INTO public.bgm_member_dashboard_hero (id, image_path)
VALUES (1, NULL) ON CONFLICT (id) DO NOTHING;
