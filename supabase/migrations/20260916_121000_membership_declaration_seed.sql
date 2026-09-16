-- Seed only declaration content backed by the approved Generic Membership form PDF.
-- Do not invent or seed privacy/health wording here.

insert into public.bgm_membership_declaration_versions (
  content_key,
  version_no,
  body,
  content_sha256,
  status,
  published_at,
  created_by_system_user_id
)
values
(
  'gym_rules',
  1,
  $body$1. No towel, no training. Towels are to be used on benches and machines at all times.
2. No heavy banging when using free weights.
3. Weights are to be replaced after use.
4. No loud talking or shouting.
5. Proper clothing and gym shoes must be worn.
6. Hygiene is of high importance, shower if you smell.
7. The management is not responsible for any theft.
8. The management is not responsible for any injuries.
9. Membership is not transferable or frozen for any reason what so ever.
10. Membership is not refundable
11. The management has the right to stop a membership if rules are not followed.$body$,
  'ec5cb4a9c9faf43ea6df80e1975120a413fa75508be148dbbf45e8793161d5a9',
  'published',
  now(),
  null
),
(
  'legacy_declaration',
  1,
  $body$I declare that the above details are correct and in the event of me being accepted, I undertake to abide by the Rules and Regulations set by the Management. I will not hold the Management responsible for the loss of or damage to my property/personal belongings within the confines of the BGM premises or grounds. I accept to exercise and use the facilities at my own risk with the prior consent of my doctor.$body$,
  '601a2706d6fe136115c0c11ff894eb05500797031d7199a7522665c47b969ce3',
  'published',
  now(),
  null
)
on conflict (content_key, version_no) do nothing;
