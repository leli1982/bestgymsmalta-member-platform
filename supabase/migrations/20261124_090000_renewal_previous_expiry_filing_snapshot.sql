-- Staff-only filing snapshot: the member's old expiry at the moment
-- a renewal application is prepared. Never changes membership dates.
-- New memberships and legacy applications legitimately retain NULL.
ALTER TABLE public.bgm_membership_application_members
  ADD COLUMN IF NOT EXISTS previous_expiry_date date;

COMMENT ON COLUMN public.bgm_membership_application_members.previous_expiry_date
  IS 'Previous existing-member expiry captured at renewal submission for staff clerical filing; not used to calculate or change entitlement.';
