-- Plan 03 Task 6: missing official photo is a warning, never an access denial.
alter table public.bgm_access_scans
  add column if not exists photo_required_warning boolean not null default false;

comment on column public.bgm_access_scans.photo_required_warning is
  'True when access was evaluated normally but the member had no official photo at scan time.';

-- Preserve the historical photo_required result for old rows/finalizer compatibility.
-- New scans use the ordinary access result plus photo_required_warning.
