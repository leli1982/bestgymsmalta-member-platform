# HU20 real-staff pilot — kiosk compatibility gate

These changes remain in the isolated BGM TEST Preview. They must be tested before activating `BGM_HU20_REAL_STAFF_PILOT_ENABLED`.

- The kiosk preflight identifies exactly one of fictional-only and controlled staff-pilot TEST modes. The native kiosk refuses ambiguous preflight data.
- The roster and attendance responses now declare the same mode explicitly; the Windows kiosk rejects cross-mode or missing mode fields before counting a punch successful.
- Super Admin's kiosk panel accepts either valid TEST response instead of requiring fictional-only under pilot mode.
- The native launcher and dynamic display distinguish supervised staff pilot from fictional TEST. Neither implies production.
- Native scripts changed: the **46-file installer and currently installed software are pinned to the earlier version**. Do not scan real employees until an updated offline package has been generated and installed on the TEST terminal.
- Before pilot activation, validate TEST SQL in project `vlvyqdjhzdcxatilbdiv`: `supabase/test-only/hu20-real-staff-pilot-approvals.sql` then `supabase/test-only/hu20-real-staff-pilot-paths.sql`.
- Feature flag remains OFF until native, SQL, and attendance integration tests pass. Production remains unchanged.
