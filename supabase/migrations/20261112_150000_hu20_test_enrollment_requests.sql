-- HU20 TEST-only: supervised enrollment request queue.
-- Applied to TEST Supabase vlvyqdjhzdcxatilbdiv; NEVER apply to Production until reviewed.
-- This migration does not create/store fingerprint templates or enable attendance.
CREATE TABLE IF NOT EXISTS public.bgm_hu20_enrollment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.bgm_staff_employees(id) ON DELETE RESTRICT,
  terminal_id uuid NOT NULL REFERENCES public.bgm_staff_terminals(id) ON DELETE RESTRICT,
  initiated_by_system_user_id uuid NOT NULL REFERENCES public.bgm_system_users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','completed','cancelled','expired')),
  expires_at timestamptz NOT NULL,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX IF NOT EXISTS bgm_hu20_enrollment_pending_employee_idx
  ON public.bgm_hu20_enrollment_requests(employee_id) WHERE status='pending';
CREATE INDEX IF NOT EXISTS bgm_hu20_enrollment_terminal_status_idx
  ON public.bgm_hu20_enrollment_requests(terminal_id,status,created_at DESC);
ALTER TABLE public.bgm_hu20_enrollment_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.bgm_hu20_enrollment_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.bgm_hu20_enrollment_requests TO service_role;
