-- Member-controlled greeting name only; official identity is never modified.
alter table public.bgm_members
  add column app_preferred_name text,
  add constraint bgm_members_app_preferred_name_check check (
    app_preferred_name is null or (
      char_length(app_preferred_name) between 1 and 40
      and app_preferred_name=btrim(app_preferred_name)
      and app_preferred_name !~ '[[:cntrl:]]'
    )
  );
comment on column public.bgm_members.app_preferred_name is 'Optional Members App greeting name. Not an official membership or identity name.';
