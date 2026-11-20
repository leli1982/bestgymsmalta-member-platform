-- Keep a separately adjustable focal position for the member welcome image.
-- Existing published images and the default image are preserved.
ALTER TABLE public.bgm_member_dashboard_hero
  ADD COLUMN IF NOT EXISTS position_x numeric(5,2) NOT NULL DEFAULT 38.00
    CONSTRAINT bgm_member_dashboard_hero_position_x_range CHECK (position_x BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS position_y numeric(5,2) NOT NULL DEFAULT 50.00
    CONSTRAINT bgm_member_dashboard_hero_position_y_range CHECK (position_y BETWEEN 0 AND 100);
